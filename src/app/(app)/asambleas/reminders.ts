/** Recordatorios de asamblea: cuánto antes de la fecha se envían. */
export const REMINDERS = {
  "7d": { ms: 7 * 24 * 3600_000, label: "en 7 días", option: "7 días antes" },
  "1d": { ms: 24 * 3600_000, label: "mañana", option: "1 día antes" },
  "1h": { ms: 3600_000, label: "en 1 hora", option: "1 hora antes" },
} as const;

export type ReminderKey = keyof typeof REMINDERS;

export const isReminderKey = (k: string): k is ReminderKey => k in REMINDERS;

/** Qué recordatorios pendientes tiene una asamblea (para precargar el formulario de edición). */
export function reminderKeysFor(
  scheduledIso: string,
  reminders: { remind_at: string; sent_at: string | null }[],
): ReminderKey[] {
  const scheduled = Date.parse(scheduledIso);
  return (Object.keys(REMINDERS) as ReminderKey[]).filter((k) =>
    reminders.some((r) => !r.sent_at && Math.abs(scheduled - Date.parse(r.remind_at) - REMINDERS[k].ms) < 60_000),
  );
}
