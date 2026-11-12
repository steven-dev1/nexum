/** Opciones y mensajes de las invitaciones (compartidos entre servidor y formularios). */

const HOUR = 3600_000;

/** Vigencias predefinidas; «custom» deja elegir fecha y hora exactas. */
export const DURATIONS = [
  { value: "1h", label: "1 hora", ms: HOUR },
  { value: "6h", label: "6 horas", ms: 6 * HOUR },
  { value: "24h", label: "24 horas", ms: 24 * HOUR },
  { value: "3d", label: "3 días", ms: 72 * HOUR },
  { value: "7d", label: "7 días", ms: 168 * HOUR },
  { value: "15d", label: "15 días", ms: 360 * HOUR },
  { value: "30d", label: "30 días", ms: 720 * HOUR },
] as const;

export const MAX_VALIDITY_DAYS = 90;

export const USES = [1, 2, 3, 5, 10, 20, 50] as const;

/** Por qué un enlace no sirve (códigos de `invitation_info` y `redeem_invitation`). */
export const INVITE_REASONS: Record<string, string> = {
  no_existe: "Este enlace no es válido. Revisa que lo hayas copiado completo.",
  vencida: "Este enlace ya venció. Pídele a la administración uno nuevo.",
  revocada: "Este enlace fue cancelado por la administración. Pide uno nuevo.",
  agotada: "Este enlace ya se usó el máximo de veces. Pide uno nuevo.",
  ya_tiene_acceso: "Tu cuenta ya tiene acceso al conjunto.",
  sin_sesion: "Inicia sesión para usar este enlace.",
  sin_perfil: "No encontramos tu perfil. Cierra sesión y vuelve a intentarlo.",
};

export const inviteReason = (code: string | null | undefined) =>
  INVITE_REASONS[code ?? ""] ?? "No se pudo usar este enlace. Pídele a la administración uno nuevo.";

/** Saca el código de un enlace completo o de un código suelto pegado por el usuario. */
export function tokenFromInput(input: string): string {
  const value = input.trim();
  const match = value.match(/\/invitacion\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : value.replace(/[^A-Za-z0-9_-]/g, "");
}
