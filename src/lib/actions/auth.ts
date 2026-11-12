"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ingresa tu correo y contraseña." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect("/");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!fullName || !email) return { error: "Completa tu nombre y correo." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    if (error.code === "user_already_exists") return { error: "Ya existe una cuenta con ese correo." };
    if (error.code === "weak_password") return { error: "La contraseña es demasiado débil." };
    return { error: error.message };
  }

  // Con la confirmación de correo desactivada en Supabase, signUp ya devuelve
  // sesión. Si no la devuelve, entramos con la misma contraseña para no pedir
  // el paso extra; solo falla si el proyecto aún exige confirmar el correo.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      if (signInError.code === "email_not_confirmed") {
        return { ok: "Cuenta creada. Revisa tu correo para confirmarla y luego ingresa." };
      }
      return { error: signInError.message };
    }
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
