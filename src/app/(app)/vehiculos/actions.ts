"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getProfile, isAdmin } from "@/lib/auth";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { createClient } from "@/lib/supabase/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const KINDS = ["carro", "moto", "otro"];
const MAX_PER_UNIT = 6;

const PHOTO_BUCKET = "vehicle-photos";
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Foto opcional del formulario: devuelve el archivo (si hay) o un error de validación. */
function readPhoto(formData: FormData): { file: File | null } | { error: string } {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { file: null };
  if (!PHOTO_TYPES[photo.type]) return { error: "La foto debe ser JPG, PNG o WEBP." };
  if (photo.size > PHOTO_MAX_BYTES) return { error: "La foto es demasiado grande (máx. 4 MB)." };
  return { file: photo };
}

/** Sube la foto a la carpeta de la unidad (`<unidad>/<uuid>.<ext>`) y devuelve la ruta, o null si falla. */
async function uploadPhoto(supabase: Supabase, unitId: string, file: File) {
  const path = `${unitId}/${crypto.randomUUID()}.${PHOTO_TYPES[file.type]}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  return error ? null : path;
}

const removePhoto = (supabase: Supabase, path: string | null | undefined) =>
  path ? supabase.storage.from(PHOTO_BUCKET).remove([path]) : Promise.resolve();

function readVehicle(formData: FormData) {
  const plate = normalizePlate(text(formData, "plate"));
  const kind = text(formData, "kind");
  const brand = text(formData, "brand");
  const color = text(formData, "color");
  if (!isValidPlate(plate)) return { error: "La placa debe tener el formato ABC123 (carro) o ABC12D (moto)." } as const;
  if (!KINDS.includes(kind)) return { error: "Elige el tipo de vehículo." } as const;
  if (brand.length > 60 || color.length > 40) return { error: "La marca o el color son demasiado largos." } as const;
  return { row: { plate, kind, brand: brand || null, color: color || null } } as const;
}

const isDuplicate = (e: { code?: string } | null) => e?.code === "23505";

export async function createVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  const admin = isAdmin(profile);
  if (!admin && !(profile.role === "residente" && profile.unitId)) {
    return { error: "Solo los residentes y la administración registran vehículos." };
  }
  const parsed = readVehicle(formData);
  if ("error" in parsed) return { error: parsed.error };

  const unitId = admin ? text(formData, "unit_id") : profile.unitId;
  if (!unitId) return { error: "Elige la unidad del vehículo." };

  const supabase = await createClient();
  const { count } = await supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("unit_id", unitId);
  if ((count ?? 0) >= MAX_PER_UNIT) return { error: `Cada unidad puede tener hasta ${MAX_PER_UNIT} vehículos.` };

  const photo = readPhoto(formData);
  if ("error" in photo) return { error: photo.error };
  const photoPath = photo.file ? await uploadPhoto(supabase, unitId, photo.file) : null;

  const { error } = await supabase.from("vehicles").insert({ ...parsed.row, unit_id: unitId, photo_path: photoPath });
  if (error) {
    await removePhoto(supabase, photoPath); // no dejar la foto huérfana
    return { error: isDuplicate(error) ? "Esa placa ya está registrada." : "No se pudo registrar el vehículo." };
  }

  revalidatePath("/vehiculos");
  return { ok: photo.file && !photoPath ? "Vehículo registrado, pero no se pudo guardar la foto." : "Vehículo registrado." };
}

export async function updateVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await getProfile();
  const id = text(formData, "id");
  if (!id) return { error: "Vehículo inválido." };
  const parsed = readVehicle(formData);
  if ("error" in parsed) return { error: parsed.error };

  const photo = readPhoto(formData);
  if ("error" in photo) return { error: photo.error };

  const supabase = await createClient();
  // La RLS limita al residente a los vehículos de su unidad.
  const { data: current } = await supabase.from("vehicles").select("unit_id, photo_path").eq("id", id).maybeSingle();
  if (!current) return { error: "No se encontró el vehículo." };

  // Foto nueva (reemplaza a la anterior) o «quitar foto».
  let photoPath: string | null | undefined;
  let uploadFailed = false;
  if (photo.file) {
    const uploaded = await uploadPhoto(supabase, current.unit_id, photo.file);
    // Si la subida falla, la foto anterior se conserva.
    if (uploaded) photoPath = uploaded;
    else uploadFailed = true;
  } else if (formData.get("remove_photo") === "on") photoPath = null;

  const { data, error } = await supabase
    .from("vehicles")
    .update({
      ...parsed.row,
      active: formData.get("active") === "on",
      ...(photoPath !== undefined ? { photo_path: photoPath } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) {
    if (photoPath) await removePhoto(supabase, photoPath);
    return { error: isDuplicate(error) ? "Esa placa ya está registrada." : "No se pudo guardar el vehículo." };
  }
  // Se borra la foto anterior solo cuando ya no se usa.
  if (photoPath !== undefined && current.photo_path) await removePhoto(supabase, current.photo_path);

  revalidatePath("/vehiculos");
  revalidatePath("/accesos");
  return { ok: uploadFailed ? "Vehículo actualizado, pero no se pudo guardar la foto." : "Vehículo actualizado." };
}

export async function deleteVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await getProfile();
  const id = text(formData, "id");
  if (!id) return { error: "Vehículo inválido." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("vehicles").select("photo_path").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("vehicles").delete().eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: "No se pudo eliminar el vehículo." };
  await removePhoto(supabase, current?.photo_path);

  revalidatePath("/vehiculos");
  return { ok: "Vehículo eliminado." };
}
