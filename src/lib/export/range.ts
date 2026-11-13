/**
 * Rango de fechas de los exportes. Lógica pura (probada en `tests/export.test.ts`): las fechas llegan como
 * «YYYY-MM-DD» en hora de Colombia (UTC-5, sin horario de verano).
 */

export const MAX_RANGE_DAYS = 366;
export const DEFAULT_RANGE_DAYS = 30;

const DAY_MS = 24 * 3600_000;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Suma días a «YYYY-MM-DD» (calendario, sin zonas horarias). */
export function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Hoy en Colombia como «YYYY-MM-DD». */
export const todayInBogota = (now: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);

export type DayRange = {
  from: string;
  to: string;
  /** Límites en UTC para filtrar: [fromIso, toIso) — `to` incluye todo ese día. */
  fromIso: string;
  toIso: string;
};

/**
 * Valida el rango pedido. Sin fechas, usa los últimos 30 días. Devuelve un mensaje de error si el rango no sirve.
 */
export function resolveRange(
  from: string | null | undefined,
  to: string | null | undefined,
  now: Date = new Date(),
): { range: DayRange } | { error: string } {
  const today = todayInBogota(now);
  const end = to && to.length > 0 ? to : today;
  const start = from && from.length > 0 ? from : addDays(end, -(DEFAULT_RANGE_DAYS - 1));

  if (!isDate(start) || !isDate(end)) return { error: "Las fechas deben tener el formato AAAA-MM-DD." };
  if (start > end) return { error: "La fecha inicial no puede ser posterior a la final." };
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS + 1;
  if (days > MAX_RANGE_DAYS) return { error: `El rango máximo es de ${MAX_RANGE_DAYS} días.` };

  return {
    range: {
      from: start,
      to: end,
      fromIso: new Date(`${start}T00:00:00-05:00`).toISOString(),
      toIso: new Date(`${addDays(end, 1)}T00:00:00-05:00`).toISOString(),
    },
  };
}
