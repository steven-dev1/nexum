/**
 * Placas de vehículos y comandos de voz de portería. Todo es lógica pura (sin servidor ni navegador),
 * así que se prueba aparte en `tests/plate.test.ts`.
 *
 * Formatos colombianos: carro `ABC123` y moto `ABC12D`.
 */

export type Direction = "ingreso" | "salida";

export const normalizePlate = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const isValidPlate = (plate: string) => /^[A-Z]{3}\d{3}$/.test(plate) || /^[A-Z]{3}\d{2}[A-Z]$/.test(plate);

/** «ABC123» → «A, B, C, 1, 2, 3» (para leerla en voz alta sin que el sintetizador la junte en una palabra). */
export const spellPlate = (plate: string) => plate.split("").join(", ");

// ---------------------------------------------------------------------------
// Voz → placa
// ---------------------------------------------------------------------------

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const DIGIT_WORDS: Record<string, string> = {
  cero: "0",
  uno: "1",
  un: "1",
  una: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9",
};

/** Nombres de las letras en español (y variantes que suele devolver el reconocedor). */
const LETTER_NAMES: Record<string, string> = {
  be: "B",
  ve: "V",
  uve: "V",
  ce: "C",
  se: "C",
  de: "D",
  efe: "F",
  fe: "F",
  ge: "G",
  je: "G",
  hache: "H",
  ache: "H",
  jota: "J",
  ka: "K",
  ele: "L",
  eme: "M",
  ene: "N",
  pe: "P",
  cu: "Q",
  erre: "R",
  ere: "R",
  ese: "S",
  te: "T",
  equis: "X",
  ye: "Y",
  zeta: "Z",
  seta: "Z",
};

/** Alfabeto fonético internacional. */
const PHONETIC: Record<string, string> = {
  alfa: "A",
  alpha: "A",
  bravo: "B",
  charlie: "C",
  charli: "C",
  delta: "D",
  eco: "E",
  echo: "E",
  foxtrot: "F",
  golf: "G",
  hotel: "H",
  india: "I",
  juliet: "J",
  juliett: "J",
  kilo: "K",
  lima: "L",
  mike: "M",
  november: "N",
  oscar: "O",
  papa: "P",
  quebec: "Q",
  romeo: "R",
  sierra: "S",
  tango: "T",
  uniforme: "U",
  victor: "V",
  whisky: "W",
  xray: "X",
  yankee: "Y",
  zulu: "Z",
};

const INGRESO = new Set(["ingresa", "ingresar", "ingreso", "ingrese", "entra", "entrar", "entrada", "entre", "abre", "abrir"]);
const SALIDA = new Set(["sale", "salir", "salida", "salga"]);
const FILLER = new Set(["placa", "placas", "numero", "numeros", "por", "favor", "vehiculo", "carro", "moto", "es", "la", "el", "con", "letras"]);

/** Convierte los tokens dictados en caracteres de placa (una letra/dígito por elemento). */
function tokensToChars(tokens: string[]): string[] {
  const chars: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];

    if (t === "doble" && (next === "ve" || next === "uve")) {
      chars.push("W");
      i++;
    } else if (t === "i" && next === "griega") {
      chars.push("Y");
      i++;
    } else if (t === "griega" || FILLER.has(t)) {
      continue;
    } else if (t in DIGIT_WORDS) {
      chars.push(DIGIT_WORDS[t]);
    } else if (t in PHONETIC) {
      chars.push(PHONETIC[t]);
    } else if (t in LETTER_NAMES) {
      chars.push(LETTER_NAMES[t]);
    } else if (/^[a-z0-9]+$/.test(t) && t.length <= 8) {
      // «a», «b», «abc», «123», «12d»: cada carácter cuenta.
      chars.push(...t.toUpperCase().split(""));
    }
  }
  return chars;
}

// Confusiones típicas del reconocedor según la posición en la placa.
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z" };
const TO_DIGIT: Record<string, string> = { O: "0", I: "1", S: "5", B: "8", Z: "2", L: "1" };

/** Placas válidas que salen de esos caracteres (corrigiendo letras/dígitos confundidos por su posición). */
function platesFromChars(chars: string[]): string[] {
  const found: string[] = [];
  const add = (p: string) => isValidPlate(p) && !found.includes(p) && found.push(p);

  const tryWindow = (w: string[]) => {
    add(w.join(""));
    const head = w.slice(0, 3).map((c) => TO_LETTER[c] ?? c);
    const mid = w.slice(3, 5).map((c) => TO_DIGIT[c] ?? c);
    const last = w[5];
    add([...head, ...mid, last].join("")); // moto (última = letra)
    add([...head, ...mid, TO_DIGIT[last] ?? last].join("")); // carro (última = dígito)
  };

  if (chars.length === 6) tryWindow(chars);
  // Con caracteres de más (muletillas), se prueba cada ventana de 6.
  if (chars.length > 6) for (let i = 0; i + 6 <= chars.length; i++) tryWindow(chars.slice(i, i + 6));
  return found;
}

export type SpokenCommand = {
  /** La orden dicha («ingresa»/«sale»); null si no se dijo. */
  direction: Direction | null;
  /** Placas válidas posibles, de la más probable a la menos (según el orden de las alternativas). */
  plates: string[];
};

/**
 * Interpreta lo que dijo el portero: «ingresa placa ABC123», «sale placa a be ce uno dos tres»,
 * «ingreso placa alfa bravo charlie 1 2 3»… `alternatives` son las hipótesis del reconocedor, de la mejor a la peor.
 */
export function parseSpokenCommand(alternatives: string[]): SpokenCommand {
  let direction: Direction | null = null;
  const plates: string[] = [];

  for (const alt of alternatives) {
    const tokens = strip(alt)
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean);

    const cmd = tokens.findIndex((t) => INGRESO.has(t) || SALIDA.has(t));
    const dir: Direction | null = cmd >= 0 ? (INGRESO.has(tokens[cmd]) ? "ingreso" : "salida") : null;
    if (!direction && dir) direction = dir;

    // La placa va después de «placa»; si no se dijo, después de la orden; si tampoco, todo.
    const marker = tokens.indexOf("placa");
    const start = marker >= 0 ? marker + 1 : cmd >= 0 ? cmd + 1 : 0;
    for (const p of platesFromChars(tokensToChars(tokens.slice(start)))) {
      if (!plates.includes(p)) plates.push(p);
    }
  }
  return { direction, plates };
}

// ---------------------------------------------------------------------------
// Placas parecidas
// ---------------------------------------------------------------------------

/**
 * Placas registradas que difieren en un solo carácter de `plate` (típico error de dictado: B/V, C/S/Z…).
 * Sirven para sugerir «¿quisiste decir…?»; nunca para autorizar solas.
 */
export function nearMatches(plate: string, known: string[]): string[] {
  return known.filter((k) => {
    if (k === plate || k.length !== plate.length) return false;
    let diff = 0;
    for (let i = 0; i < k.length && diff <= 1; i++) if (k[i] !== plate[i]) diff++;
    return diff === 1;
  });
}
