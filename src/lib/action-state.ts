export type ActionState = {
  error?: string;
  ok?: string;
  /** Solo al crear una invitación: el enlace completo (se muestra una vez). */
  link?: string;
  expiresAt?: string;
} | null;
