/**
 * Celular → número internacional sin «+» (el formato que pide WhatsApp), o null si no es válido.
 * Un celular colombiano de 10 dígitos que empieza por 3 se completa con el indicativo 57.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^573\d{9}$/.test(digits)) return digits;
  // Otros países: número internacional completo con su indicativo (11–15 dígitos). Uno de 10 dígitos
  // que no empieza por 3 es un fijo colombiano, que no tiene WhatsApp.
  if (/^[1-9]\d{10,14}$/.test(digits) && !digits.startsWith("57")) return digits;
  return null;
}

/** Texto apto para una variable de plantilla de WhatsApp: sin saltos de línea ni tabulaciones, y con límite. */
export function templateText(value: string, max: number): string {
  const clean = value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
