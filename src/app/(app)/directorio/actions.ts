"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getProfile, isAdmin } from "@/lib/auth";
import { toWhatsAppNumber } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const CATEGORIES = ["emergencia", "administracion", "proveedor", "servicio", "otro"];

function readEntry(formData: FormData) {
  const name = text(formData, "name");
  const category = text(formData, "category");
  const phone = text(formData, "phone");
  const description = text(formData, "description");
  const schedule = text(formData, "schedule");
  const hasWhatsapp = formData.get("has_whatsapp") === "on";

  if (!name || name.length > 120) return { error: "Escribe el nombre (hasta 120 caracteres)." } as const;
  if (!CATEGORIES.includes(category)) return { error: "Elige una categoría." } as const;
  if (phone.length > 40) return { error: "El teléfono es demasiado largo." } as const;
  if (description.length > 500 || schedule.length > 120) return { error: "Hay un texto demasiado largo." } as const;
  if (hasWhatsapp && !toWhatsAppNumber(phone)) {
    return { error: "Para enlazar WhatsApp el teléfono debe ser un celular válido." } as const;
  }
  return {
    row: {
      name,
      category,
      phone: phone || null,
      has_whatsapp: hasWhatsapp && !!phone,
      description: description || null,
      schedule: schedule || null,
    },
  } as const;
}

export async function createEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración edita el directorio." };
  const parsed = readEntry(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("directory_entries").insert(parsed.row);
  if (error) return { error: "No se pudo guardar el contacto." };
  revalidatePath("/directorio");
  return { ok: "Contacto agregado." };
}

export async function updateEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración edita el directorio." };
  const id = text(formData, "id");
  if (!id) return { error: "Contacto inválido." };
  const parsed = readEntry(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("directory_entries").update(parsed.row).eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: "No se pudo guardar el contacto." };
  revalidatePath("/directorio");
  return { ok: "Contacto actualizado." };
}

export async function deleteEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración edita el directorio." };
  const id = text(formData, "id");
  if (!id) return { error: "Contacto inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("directory_entries").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el contacto." };
  revalidatePath("/directorio");
  return { ok: "Contacto eliminado." };
}
