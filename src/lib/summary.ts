/**
 * Resumen de administración: forma tipada de lo que devuelve `public.admin_summary` y utilidades puras para
 * mostrarlo. Se leen todos los campos con valores por defecto, así una versión vieja de la función no rompe la pantalla.
 */

export type DayPoint = { day: string; packages: number; access: number; visits: number };

export type OpenPoll = { id: string; question: string; closes_at: string | null; voted: number; total: number };

export type Summary = {
  days: number;
  users: { residents: number; staff: number; withoutUnit: number; units: number; unitsWithResidents: number; activeInvitations: number };
  packages: { pending: number; received: number; delivered: number };
  announcements: { published: number; scheduled: number; drafts: number; readRate: number };
  reservations: { today: number; upcoming: number };
  polls: OpenPoll[];
  access: { vehiclesInside: number; movementsToday: number; denied: number };
  visits: { inside: number; waiting: number; authorized: number; period: number };
  series: DayPoint[];
};

type Raw = Record<string, unknown> | null | undefined;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export function parseSummary(raw: unknown): Summary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  const users = obj(r?.users);
  const packages = obj(r?.packages);
  const ann = obj(r?.announcements);
  const res = obj(r?.reservations);
  const access = obj(r?.access);
  const visits = obj(r?.visits);
  const polls = obj(r?.polls);
  const series = Array.isArray(r?.series) ? (r?.series as unknown[]) : [];
  const open = Array.isArray(polls.open) ? (polls.open as unknown[]) : [];

  return {
    days: num(r?.days) || 7,
    users: {
      residents: num(users.residents),
      staff: num(users.staff),
      withoutUnit: num(users.without_unit),
      units: num(users.units),
      unitsWithResidents: num(users.units_with_residents),
      activeInvitations: num(users.active_invitations),
    },
    packages: { pending: num(packages.pending), received: num(packages.received), delivered: num(packages.delivered) },
    announcements: {
      published: num(ann.published),
      scheduled: num(ann.scheduled),
      drafts: num(ann.drafts),
      readRate: num(ann.read_rate),
    },
    reservations: { today: num(res.today), upcoming: num(res.upcoming) },
    polls: open.map((p) => {
      const o = obj(p);
      return {
        id: String(o.id ?? ""),
        question: String(o.question ?? ""),
        closes_at: typeof o.closes_at === "string" ? o.closes_at : null,
        voted: num(o.voted),
        total: num(o.total),
      };
    }),
    access: { vehiclesInside: num(access.vehicles_inside), movementsToday: num(access.movements_today), denied: num(access.denied) },
    visits: { inside: num(visits.inside), waiting: num(visits.waiting), authorized: num(visits.authorized), period: num(visits.period) },
    series: series.map((p) => {
      const o = obj(p);
      return { day: String(o.day ?? ""), packages: num(o.packages), access: num(o.access), visits: num(o.visits) };
    }),
  };
}

/** Porcentaje entero (0–100) de `part` sobre `total`; 0 si no hay total. */
export const percent = (part: number, total: number) => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0);

/** «2026-11-13» → «13 nov» (sin zona horaria: la fecha ya viene en hora de Colombia). */
export function shortDay(day: string) {
  const [, m, d] = day.split("-").map(Number);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return m >= 1 && m <= 12 ? `${d} ${months[m - 1]}` : day;
}

/** Altura relativa (0–100) de una barra respecto al máximo de la serie; las barras con valor nunca quedan en 0. */
export function barHeight(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(6, Math.round((value / max) * 100));
}
