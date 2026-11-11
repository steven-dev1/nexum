"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isStaff } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

export async function registerPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isStaff(profile)) return { error: "Solo portería o administración registra paquetes." };

  const unitId = text(formData, "unit_id");
  if (!unitId) return { error: "Selecciona la unidad destinataria." };

  const supabase = await createClient();
  const { error } = await supabase.from("packages").insert({
    unit_id: unitId,
    recipient_name: text(formData, "recipient_name"),
    carrier: text(formData, "carrier"),
    description: text(formData, "description"),
  });
  if (error) return { error: "No se pudo registrar el paquete. Intenta de nuevo." };

  revalidatePath("/paqueteria");
  revalidatePath("/");
  return { ok: "Paquete registrado." };
}

export async function deliverPackage(formData: FormData) {
  const profile = await getProfile();
  if (!isStaff(profile)) throw new Error("Sin permiso");

  const id = text(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("packages")
    .update({
      status: "entregado",
      delivered_at: new Date().toISOString(),
      delivered_to: text(formData, "delivered_to"),
    })
    .eq("id", id)
    .eq("status", "recibido");
  if (error) throw new Error("No se pudo marcar como entregado");

  revalidatePath("/paqueteria");
  revalidatePath("/");
}
