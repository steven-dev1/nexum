"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getProfile } from "@/lib/auth";
import { toWhatsAppNumber } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/** Guarda el celular de quien está conectado y si acepta recibir avisos por WhatsApp. */
export async function updateMyContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await getProfile();
  const phone = String(formData.get("phone") ?? "").trim();
  const whatsapp = formData.get("whatsapp") === "on";

  if (whatsapp && !toWhatsAppNumber(phone)) {
    return { error: "Escribe un celular válido (por ejemplo 3001234567) para recibir WhatsApp." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_my_contact", { p_phone: phone, p_whatsapp: whatsapp });
  if (error || data !== "ok") return { error: "No se pudo guardar. Intenta de nuevo." };

  revalidatePath("/", "layout");
  return { ok: whatsapp ? "Listo: recibirás los avisos por WhatsApp." : "Guardado. No recibirás avisos por WhatsApp." };
}
