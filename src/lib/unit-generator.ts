/**
 * Genera la lista de unidades de un conjunto. Pura (sin servidor ni base de datos): la usa la
 * acción que crea las unidades y el formulario para mostrar la vista previa.
 *
 * No supone una organización: el administrador describe la suya (pisos y unidades por piso, o una
 * lista libre para casas y locales) y elige cómo se numeran.
 */

export const MAX_UNITS = 500;
export const MIN_FLOOR = -10;
export const MAX_FLOOR = 200;

export type GeneratedUnit = { tower: string; number: string; floor: number | null };

export type NumberingStyle = "piso-consecutivo" | "piso-letra" | "corrido";

export type GeneratorInput = {
  mode: "pisos" | "lista";
  tower: string;
  prefix: string;
  // modo «pisos»
  floorFrom: string;
  floorTo: string;
  perFloor: string;
  style: NumberingStyle | string;
  // modo «lista»
  numbers: string;
  floor: string;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** «101, 102 201-205» → «101», «102», «201»…«205» (los rangos solo aplican a números). */
function parseList(input: string): string[] | null {
  const out = new Set<string>();
  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to < from || to - from + 1 > MAX_UNITS) return null;
      for (let n = from; n <= to; n++) out.add(String(n));
    } else {
      out.add(token);
    }
    if (out.size > MAX_UNITS) return null;
  }
  return [...out];
}

export function generateUnits(input: GeneratorInput): { units: GeneratedUnit[] } | { error: string } {
  const tower = input.tower.trim().slice(0, 40);
  const prefix = input.prefix.slice(0, 12);
  const units: GeneratedUnit[] = [];

  if (input.mode === "pisos") {
    const from = Number.parseInt(input.floorFrom, 10);
    const to = Number.parseInt(input.floorTo, 10);
    const perFloor = Number.parseInt(input.perFloor, 10);

    if ([from, to, perFloor].some(Number.isNaN)) return { error: "Completa los pisos y las unidades por piso." };
    if (from < MIN_FLOOR || to > MAX_FLOOR || to < from) {
      return { error: `Los pisos deben estar entre ${MIN_FLOOR} y ${MAX_FLOOR}, de menor a mayor.` };
    }
    if (perFloor < 1 || perFloor > 99) return { error: "Las unidades por piso deben estar entre 1 y 99." };
    if (input.style === "piso-letra" && perFloor > 26) return { error: "Con letras, máximo 26 unidades por piso." };
    if ((to - from + 1) * perFloor > MAX_UNITS) return { error: `Máximo ${MAX_UNITS} unidades a la vez.` };

    let running = 0;
    for (let floor = from; floor <= to; floor++) {
      for (let i = 1; i <= perFloor; i++) {
        running++;
        const number =
          input.style === "corrido"
            ? String(running)
            : input.style === "piso-letra"
              ? `${floor}${LETTERS[i - 1]}`
              : String(floor * 100 + i); // 3.er piso, unidad 2 → 302
        units.push({ tower, number: prefix + number, floor });
      }
    }
  } else {
    const numbers = parseList(input.numbers);
    if (!numbers || numbers.length === 0) {
      return { error: `Escribe los números (ej. 1-40 o 101, 102). Máximo ${MAX_UNITS} a la vez.` };
    }
    const floor = input.floor.trim() === "" ? null : Number.parseInt(input.floor, 10);
    if (floor !== null && (Number.isNaN(floor) || floor < MIN_FLOOR || floor > MAX_FLOOR)) {
      return { error: "El piso no es válido." };
    }
    for (const n of numbers) units.push({ tower, number: prefix + n, floor });
  }

  if (units.some((u) => u.number.length > 24)) {
    return { error: "Los números son demasiado largos (máx. 24 caracteres)." };
  }
  return { units };
}
