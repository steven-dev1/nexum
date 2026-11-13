/**
 * Visitantes y vehículos con permiso temporal. Lógica pura (sin servidor ni navegador), probada en
 * `tests/visits.test.ts`. Una «visita» con `plate` nulo es un visitante a pie; con `plate`, un vehículo con
 * permiso temporal válido solo dentro de su ventana de fechas.
 */

export type VisitKind = "visita" | "domiciliario" | "proveedor" | "mudanza" | "otro";
export type VisitStatus = "por_autorizar" | "autorizada" | "rechazada" | "dentro" | "salio" | "cancelada";

export const VISIT_KINDS: { value: VisitKind; label: string; hint: string }[] = [
  { value: "visita", label: "Visita", hint: "Familiar, amigo o invitado" },
  { value: "domiciliario", label: "Domicilio", hint: "Entrega de comida o mensajería" },
  { value: "proveedor", label: "Proveedor o técnico", hint: "Plomero, electricista, aseo…" },
  { value: "mudanza", label: "Mudanza", hint: "Camión o trasteo" },
  { value: "otro", label: "Otro", hint: "Cualquier otro motivo" },
];

export const kindLabel = (kind: string) => VISIT_KINDS.find((k) => k.value === kind)?.label ?? "Visita";

/** Alfabeto del código: sin 0/O ni 1/I, para que no se confundan al dictarlo o leerlo. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

/** Lo que se escribe o se dicta → código en mayúsculas sin espacios ni guiones. */
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const isValidCode = (code: string) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);

/** Prefijo del texto del QR, para distinguir un código de Nexum de cualquier otro QR. */
export const QR_PREFIX = "NEXUM-VISITA:";

export const qrPayload = (code: string) => `${QR_PREFIX}${code}`;

/**
 * Texto leído de un QR (o escrito a mano) → código de visita, o null si no es uno válido.
 * Acepta el QR de Nexum, un enlace que traiga `?c=CODE` o el código suelto.
 */
export function parseVisitCode(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  if (value.toUpperCase().startsWith(QR_PREFIX)) {
    const code = normalizeCode(value.slice(QR_PREFIX.length));
    return isValidCode(code) ? code : null;
  }
  try {
    const url = new URL(value);
    const code = normalizeCode(url.searchParams.get("c") ?? "");
    return isValidCode(code) ? code : null;
  } catch {
    const code = normalizeCode(value);
    return isValidCode(code) ? code : null;
  }
}

/** Estado que ve la persona: «vencida» se deduce de la fecha, no se guarda. */
export type VisitView = "por_autorizar" | "esperada" | "programada" | "dentro" | "salio" | "rechazada" | "cancelada" | "vencida";

export function visitView(
  v: { status: VisitStatus; valid_from: string; valid_until: string },
  now: Date = new Date(),
): VisitView {
  const t = now.getTime();
  const from = Date.parse(v.valid_from);
  const until = Date.parse(v.valid_until);
  switch (v.status) {
    case "dentro":
    case "salio":
    case "rechazada":
    case "cancelada":
      return v.status;
    case "por_autorizar":
      return until <= t ? "vencida" : "por_autorizar";
    case "autorizada":
      if (until <= t) return "vencida";
      return from > t ? "programada" : "esperada";
  }
}

export const viewLabel: Record<VisitView, string> = {
  por_autorizar: "Por autorizar",
  esperada: "Autorizada",
  programada: "Programada",
  dentro: "Dentro",
  salio: "Salió",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
  vencida: "Vencida",
};

export const viewTone: Record<VisitView, "neutral" | "primary" | "accent" | "success" | "danger"> = {
  por_autorizar: "accent",
  esperada: "primary",
  programada: "neutral",
  dentro: "success",
  salio: "neutral",
  rechazada: "danger",
  cancelada: "neutral",
  vencida: "danger",
};

/**
 * Ventana de una visita a partir de la fecha y las horas del formulario (hora de Colombia, UTC-5).
 * Si la hora final es igual o anterior a la inicial, termina al día siguiente (p. ej. 8 p. m. → 2 a. m.).
 */
export function visitWindow(date: string, from: string, until: string): { validFrom: string; validUntil: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(until)) return null;
  const start = Date.parse(`${date}T${from}:00-05:00`);
  let end = Date.parse(`${date}T${until}:00-05:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= start) end += 24 * 3600_000;
  return { validFrom: new Date(start).toISOString(), validUntil: new Date(end).toISOString() };
}

/** Máximo que puede durar una autorización (evita permisos «para siempre»). */
export const MAX_WINDOW_HOURS = 72;

export const windowTooLong = (w: { validFrom: string; validUntil: string }) =>
  Date.parse(w.validUntil) - Date.parse(w.validFrom) > MAX_WINDOW_HOURS * 3600_000;

/** Mensaje para compartir una autorización por WhatsApp u otro medio. */
export function shareText(opts: { name: string; code: string; until: string; unit?: string; plate?: string | null }) {
  return [
    `Autorización de ingreso${opts.unit ? ` · ${opts.unit}` : ""}`,
    `Visitante: ${opts.name}${opts.plate ? ` · Placa ${opts.plate}` : ""}`,
    `Código: ${opts.code}`,
    `Válido hasta: ${opts.until}`,
    "Preséntalo en portería (código o QR).",
  ].join("\n");
}
