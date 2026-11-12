"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isStaff } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { pushInBackground, residentsOfUnit, sendPush } from "@/lib/push";

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

  const carrier = text(formData, "carrier");
  pushInBackground(async () =>
    sendPush(supabase, await residentsOfUnit(supabase, unitId), {
      title: "Te llegó un paquete",
      body: carrier ? `${carrier} dejó un paquete en portería.` : "Hay un paquete esperándote en portería.",
      url: "/paqueteria",
      tag: `paquete-${pkg.id}`,
    }),
  );

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
  const { data, error } = await supabase
    .from("packages")
    .update({
      status: "entregado",
      delivered_at: new Date().toISOString(),
      delivered_to: text(formData, "delivered_to"),
    })
    .eq("id", id)
    .eq("status", "recibido")
    .select("id, unit_id")
    .maybeSingle();
  if (error) throw new Error("No se pudo marcar como entregado");
  if (!data) return;

  pushInBackground(async () =>
    sendPush(supabase, await residentsOfUnit(supabase, data.unit_id), {
      title: "Paquete entregado",
      body: "Tu paquete ya fue recogido en portería.",
      url: "/paqueteria",
      tag: `paquete-${data.id}`,
    }),
  );

  revalidatePath("/paqueteria");
  revalidatePath("/");
}

export async function updatePackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isStaff(profile)) return { error: "Solo portería o administración edita paquetes." };

  const id = text(formData, "id");
  const unitId = text(formData, "unit_id");
  if (!id) return { error: "Paquete inválido." };
  if (!unitId) return { error: "Selecciona la unidad destinataria." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("packages")
    .select("unit_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { error: "No se encontró el paquete." };

  const { error } = await supabase
    .from("packages")
    .update({
      unit_id: unitId,
      recipient_name: text(formData, "recipient_name"),
      carrier: text(formData, "carrier"),
      description: text(formData, "description"),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar el paquete." };

  // Si cambió de unidad y sigue en portería, avisan también al residente nuevo.
  if (before.unit_id !== unitId && before.status === "recibido") {
    pushInBackground(async () =>
      sendPush(supabase, await residentsOfUnit(supabase, unitId), {
        title: "Te llegó un paquete",
        body: "Hay un paquete esperándote en portería.",
        url: "/paqueteria",
        tag: `paquete-${id}`,
      }),
    );
  }

  revalidatePath("/paqueteria");
  revalidatePath("/");
  return { ok: "Paquete actualizado." };
}

export async function deletePackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isStaff(profile)) return { error: "Solo portería o administración elimina paquetes." };

  const id = text(formData, "id");
  if (!id) return { error: "Paquete inválido." };

  const supabase = await createClient();
  const { data: pkg } = await supabase.from("packages").select("photo_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el paquete." };

  if (pkg?.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([pkg.photo_path]);

  revalidatePath("/paqueteria");
  revalidatePath("/");
  return { ok: "Paquete eliminado." };
}
