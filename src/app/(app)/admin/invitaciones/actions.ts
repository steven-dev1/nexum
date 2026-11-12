"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import { bogotaToIso } from "@/lib/format";
import { DURATIONS, MAX_VALIDITY_DAYS, USES } from "@/lib/invitation-options";
import { hashToken, newToken, siteOrigin } from "@/lib/invitations";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** Calcula cuándo vence: una vigencia predefinida o una fecha y hora exactas (hora de Colombia). */
function expiry(formData: FormData): { error: string } | { expiresAt: Date } {
  const duration = text(formData, "duration");
  const now = Date.now();

  if (duration === "custom") {
    const date = text(formData, "expires_date");
    const time = text(formData, "expires_time");
    if (!date || !time) return { error: "Elige la fecha y la hora en que vence." };
    const at = new Date(bogotaToIso(date, time));
    if (Number.isNaN(at.getTime()) || at.getTime() <= now + 60_000)
      return { error: "El vencimiento debe ser a futuro." };
    if (at.getTime() > now + MAX_VALIDITY_DAYS * 86_400_000) {
      return { error: `La vigencia máxima es de ${MAX_VALIDITY_DAYS} días.` };
    }
    return { expiresAt: at };
  }

  const preset = DURATIONS.find((d) => d.value === duration);
  if (!preset) return { error: "Elige cuánto tiempo estará vigente el enlace." };
  return { expiresAt: new Date(now + preset.ms) };
}

/** Crea un enlace de invitación. El enlace completo solo se devuelve aquí; en la BD queda su hash. */
export async function createInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getProfile();
  if (!isAdmin(me)) return { error: "Solo la administración crea invitaciones." };

  const role = text(formData, "role") === "porteria" ? "porteria" : "residente";
  const unitId = text(formData, "unit_id");
  if (role === "residente" && !unitId) return { error: "Elige la unidad a la que se invita." };

  const uses = Number(text(formData, "max_uses") || 1);
  if (!(USES as readonly number[]).includes(uses)) return { error: "Cantidad de usos inválida." };

  const when = expiry(formData);
  if ("error" in when) return { error: when.error };

  const token = newToken();
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({
    token_hash: hashToken(token),
    role,
    unit_id: role === "residente" ? unitId : null,
    label: text(formData, "label").slice(0, 80) || null,
    expires_at: when.expiresAt.toISOString(),
    max_uses: role === "porteria" ? 1 : uses,
  });
  if (error) return { error: "No se pudo crear la invitación. Intenta de nuevo." };

  revalidatePath("/admin/invitaciones");
  return {
    ok: "Invitación creada.",
    link: `${await siteOrigin()}/invitacion/${token}`,
    expiresAt: when.expiresAt.toISOString(),
  };
}

/** Cancela un enlace (deja de servir de inmediato). Las cuentas ya creadas no se afectan. */
export async function revokeInvitation(formData: FormData) {
  const me = await getProfile();
  if (!isAdmin(me)) throw new Error("Sin permiso");

  const id = text(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) throw new Error("No se pudo revocar la invitación");

  revalidatePath("/admin/invitaciones");
}
