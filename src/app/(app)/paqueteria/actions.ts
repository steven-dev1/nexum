"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isStaff } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

const PHOTO_BUCKET = "package-photos";
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export async function registerPackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isStaff(profile)) return { error: "Solo portería o administración registra paquetes." };

  const unitId = text(formData, "unit_id");
  if (!unitId) return { error: "Selecciona la unidad destinataria." };

  // Foto opcional: se valida antes de crear el paquete.
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && !PHOTO_TYPES[photo.type]) return { error: "La foto debe ser JPG, PNG o WEBP." };
  if (hasPhoto && photo.size > PHOTO_MAX_BYTES) return { error: "La foto es demasiado grande (máx. 4 MB)." };

  const supabase = await createClient();
  const { data: pkg, error } = await supabase
    .from("packages")
    .insert({
      unit_id: unitId,
      recipient_name: text(formData, "recipient_name"),
      carrier: text(formData, "carrier"),
      description: text(formData, "description"),
    })
    .select("id")
    .single();
  if (error || !pkg) return { error: "No se pudo registrar el paquete. Intenta de nuevo." };

  // La ruta la decide el servidor: <id del paquete>.<ext>
  let photoWarning = "";
  if (hasPhoto) {
    const path = `${pkg.id}.${PHOTO_TYPES[photo.type]}`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, photo, { contentType: photo.type, upsert: false });
    const { error: linkError } = uploadError
      ? { error: uploadError }
      : await supabase.from("packages").update({ photo_path: path }).eq("id", pkg.id);
    if (uploadError || linkError) photoWarning = " No se pudo guardar la foto.";
  }

  revalidatePath("/paqueteria");
  revalidatePath("/");
  return { ok: `Paquete registrado.${photoWarning}` };
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
