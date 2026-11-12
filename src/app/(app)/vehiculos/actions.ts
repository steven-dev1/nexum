"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getProfile, isAdmin } from "@/lib/auth";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { createClient } from "@/lib/supabase/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const KINDS = ["carro", "moto", "otro"];
const MAX_PER_UNIT = 6;

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

  const { error } = await supabase.from("vehicles").insert({ ...parsed.row, unit_id: unitId });
  if (isDuplicate(error)) return { error: "Esa placa ya está registrada." };
  if (error) return { error: "No se pudo registrar el vehículo." };

  revalidatePath("/vehiculos");
  return { ok: "Vehículo registrado." };
}

export async function updateVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await getProfile();
  const id = text(formData, "id");
  if (!id) return { error: "Vehículo inválido." };
  const parsed = readVehicle(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  // La RLS limita al residente a los vehículos de su unidad.
  const { data, error } = await supabase
    .from("vehicles")
    .update({ ...parsed.row, active: formData.get("active") === "on" })
    .eq("id", id)
    .select("id");
  if (isDuplicate(error)) return { error: "Esa placa ya está registrada." };
  if (error || !data || data.length === 0) return { error: "No se pudo guardar el vehículo." };

  revalidatePath("/vehiculos");
  return { ok: "Vehículo actualizado." };
}

export async function deleteVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await getProfile();
  const id = text(formData, "id");
  if (!id) return { error: "Vehículo inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicles").delete().eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: "No se pudo eliminar el vehículo." };

  revalidatePath("/vehiculos");
  return { ok: "Vehículo eliminado." };
}
