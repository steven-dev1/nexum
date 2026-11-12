// Colombia no tiene horario de verano: America/Bogota es UTC-5 todo el año.
const TZ = "America/Bogota";

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TZ,
});
const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: TZ });
const dateShort = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: TZ });
const time = new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone: TZ });
const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso));
export const fmtDateShort = (iso: string) => dateShort.format(new Date(iso));
export const fmtDate = (iso: string) => date.format(new Date(iso));
export const fmtTime = (iso: string) => time.format(new Date(iso));
export const fmtCop = (n: number) => cop.format(n);

/** "HH:MM:SS" de Postgres → "HH:MM". */
export const hhmm = (t: string) => t.slice(0, 5);

/** Horario de una zona; si cierra a la misma hora o antes de abrir, cierra al día siguiente. */
export const fmtHours = (open: string, close: string) =>
  `${hhmm(open)} – ${hhmm(close)}${close <= open ? " (día siguiente)" : ""}`;

/** Fecha de hoy en Colombia como YYYY-MM-DD (para atributos `min` de inputs). */
export const todayBogota = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

const bogotaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO → { date: "YYYY-MM-DD", time: "HH:MM" } en hora de Colombia. */
export function bogotaDateTime(iso: string) {
  const p = Object.fromEntries(bogotaParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Combina fecha (YYYY-MM-DD) y hora (HH:MM) en hora de Colombia → ISO UTC. */
export function bogotaToIso(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr}:00-05:00`).toISOString();
}
