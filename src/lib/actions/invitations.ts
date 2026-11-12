"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inviteReason, tokenFromInput } from "@/lib/invitation-options";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** Canjea el enlace para el usuario con sesión. Devuelve el código (`ok` o el motivo del rechazo). */
async function redeem(token: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_invitation", { p_token: token });
  return error ? "error" : (data as string);
}

/**
 * Crea la cuenta de quien llega con un enlace de invitación y le da acceso de inmediato.
 * El enlace se valida antes de crear nada, así no quedan cuentas sin acceso por un enlace vencido.
 */
export async function signUpWithInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = tokenFromInput(text(formData, "token"));
  const fullName = text(formData, "full_name");
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!token) return { error: inviteReason("no_existe") };
  if (!fullName || !email) return { error: "Completa tu nombre y correo." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = await createClient();
  const { data: info } = await supabase.rpc("invitation_info", { p_token: token });
  const invite = info?.[0];
  if (!invite?.valid) return { error: inviteReason(invite?.reason) };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "Ya existe una cuenta con ese correo. Inicia sesión y abre este enlace de nuevo." };
    }
    if (error.code === "weak_password") return { error: "La contraseña es demasiado débil." };
    return { error: error.message };
  }

  // Con la confirmación de correo desactivada signUp ya devuelve sesión; si no, entramos con la contraseña.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      if (signInError.code === "email_not_confirmed") {
        return {
          ok: "Cuenta creada. Confirma tu correo, inicia sesión y abre de nuevo este enlace para activar tu acceso.",
        };
      }
      return { error: signInError.message };
    }
  }

  const result = await redeem(token);
  if (result !== "ok") {
    // La cuenta quedó creada y con sesión: la pantalla de acceso permite reintentar con otro enlace.
    return { error: `${inviteReason(result)} Tu cuenta se creó; entra y pide un enlace nuevo.` };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/** Usa un enlace con una cuenta que ya existe (inició sesión y abrió el enlace, o pegó el código). */
export async function redeemInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = tokenFromInput(text(formData, "token"));
  if (!token) return { error: "Pega el enlace o el código de invitación que te enviaron." };

  const result = await redeem(token);
  if (result !== "ok") return { error: inviteReason(result) };

  revalidatePath("/", "layout");
  redirect("/");
}
