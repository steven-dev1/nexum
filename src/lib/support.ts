/**
 * Centro de ayuda: tipos, etiquetas y validaciones puras (probadas en `tests/support.test.ts`).
 */

export type TicketKind = "problema" | "ayuda" | "sugerencia";
export type TicketTarget = "administracion" | "soporte_tecnico";
export type TicketStatus = "abierta" | "en_curso" | "resuelta";

export const KINDS: { value: TicketKind; label: string; hint: string }[] = [
  { value: "ayuda", label: "Pedir ayuda", hint: "No sé cómo hacer algo" },
  { value: "problema", label: "Reportar un problema", hint: "Algo no funciona como debería" },
  { value: "sugerencia", label: "Sugerencia", hint: "Una idea para mejorar" },
];

export const TARGETS: { value: TicketTarget; label: string; hint: string }[] = [
  { value: "administracion", label: "Administración del conjunto", hint: "Dudas del conjunto, accesos, cuentas" },
  { value: "soporte_tecnico", label: "Soporte técnico de Nexum", hint: "Errores o fallas de la aplicación" },
];

export const STATUS_LABEL: Record<TicketStatus, string> = { abierta: "Abierta", en_curso: "En curso", resuelta: "Resuelta" };
export const STATUS_TONE: Record<TicketStatus, "accent" | "primary" | "success"> = {
  abierta: "accent",
  en_curso: "primary",
  resuelta: "success",
};

export const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? "Solicitud";
export const targetLabel = (t: string) => TARGETS.find((x) => x.value === t)?.label ?? "Administración del conjunto";

export const SUBJECT_MAX = 140;
export const BODY_MAX = 4000;

export const isKind = (v: string): v is TicketKind => KINDS.some((k) => k.value === v);
export const isTarget = (v: string): v is TicketTarget => TARGETS.some((t) => t.value === v);
export const isStatus = (v: string): v is TicketStatus => v in STATUS_LABEL;

/** Valida el asunto y el mensaje de una solicitud; devuelve el texto de error o null si está bien. */
export function validateTicket(subject: string, body: string): string | null {
  if (subject.trim().length < 3) return "Escribe un asunto (mínimo 3 caracteres).";
  if (subject.length > SUBJECT_MAX) return `El asunto admite hasta ${SUBJECT_MAX} caracteres.`;
  if (body.trim().length < 5) return "Cuéntanos con un poco más de detalle qué necesitas.";
  if (body.length > BODY_MAX) return `El mensaje admite hasta ${BODY_MAX} caracteres.`;
  return null;
}

/**
 * Datos del contexto que acompañan a la solicitud (sección, dispositivo, pantalla). Se recortan y se limpian:
 * lo manda el navegador, así que no se confía en su forma ni su tamaño.
 */
export function cleanContext(input: { page?: unknown; ua?: unknown; viewport?: unknown }, extra: { role?: string; version?: string } = {}) {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
  const page = str(input.page, 200);
  return {
    page: page.startsWith("/") ? page : "",
    device: str(input.ua, 300),
    viewport: /^\d{2,5}x\d{2,5}$/.test(str(input.viewport, 12)) ? str(input.viewport, 12) : "",
    role: str(extra.role, 20),
    version: str(extra.version, 40),
  };
}

export type TicketContext = ReturnType<typeof cleanContext>;

/** Cuerpo del aviso para soporte técnico (webhook): lo mínimo para atender, sin correos ni teléfonos. */
export function webhookPayload(t: {
  id: string;
  kind: string;
  subject: string;
  body: string;
  who: string;
  context: TicketContext;
  site?: string;
}) {
  const link = t.site ? `${t.site.replace(/\/$/, "")}/admin/soporte` : "";
  const text = [
    `Nueva solicitud de soporte técnico · ${kindLabel(t.kind)}`,
    `Asunto: ${t.subject}`,
    `De: ${t.who}`,
    t.context.page ? `Sección: ${t.context.page}` : "",
    t.context.device ? `Dispositivo: ${t.context.device}` : "",
    "",
    t.body.slice(0, 1500),
    link ? `\nAtender: ${link}` : "",
  ]
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n");
  // `text` y `content` cubren el formato de Slack/Mattermost y de Discord respectivamente.
  return { id: t.id, kind: t.kind, subject: t.subject, text, content: text };
}
