"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { generateUnits } from "@/lib/unit-generator";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const MAX_FLOOR = 200;
const MIN_FLOOR = -10;

/**
 * Crea unidades de una de dos formas: por pisos (rango de pisos × unidades por piso, con estilo de
 * numeración) o por lista libre (para casas y locales). Ver `generateUnits`.
 */
export async function createUnits(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getProfile();
  if (!isAdmin(me)) return { error: "Solo la administración gestiona unidades." };

  const result = generateUnits({
    mode: text(formData, "mode") === "lista" ? "lista" : "pisos",
    tower: text(formData, "tower"),
    prefix: String(formData.get("prefix") ?? ""),
    floorFrom: text(formData, "floor_from"),
    floorTo: text(formData, "floor_to"),
    perFloor: text(formData, "per_floor"),
    style: text(formData, "style") || "piso-consecutivo",
    numbers: text(formData, "numbers"),
    floor: text(formData, "floor"),
  });
  if ("error" in result) return { error: result.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .upsert(result.units, { onConflict: "tower,number", ignoreDuplicates: true });
  if (error) return { error: "No se pudieron crear las unidades." };

  revalidatePath("/admin/unidades");
  return { ok: `${result.units.length} unidades procesadas (las que ya existían se omiten).` };
}

/** Cambia el grupo, el número o el piso de una unidad (para corregir o reorganizar). */
export async function updateUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getProfile();
  if (!isAdmin(me)) return { error: "Solo la administración gestiona unidades." };

  const id = text(formData, "id");
  const tower = text(formData, "tower").slice(0, 40);
  const number = text(formData, "number");
  const floorRaw = text(formData, "floor");
  const floor = floorRaw === "" ? null : Number.parseInt(floorRaw, 10);

  if (!id) return { error: "Unidad inválida." };
  if (!number || number.length > 24) return { error: "Escribe el número de la unidad (máx. 24 caracteres)." };
  if (floor !== null && (Number.isNaN(floor) || floor < MIN_FLOOR || floor > MAX_FLOOR)) {
    return { error: "El piso no es válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("units").update({ tower, number, floor }).eq("id", id).select("id");
  if (error?.code === "23505") return { error: "Ya existe una unidad con ese grupo y número." };
  if (error || !data || data.length === 0) return { error: "No se pudo guardar la unidad." };

  revalidatePath("/admin/unidades");
  return { ok: "Unidad actualizada." };
}

export async function deleteUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getProfile();
  if (!isAdmin(me)) return { error: "Sin permiso." };

  const id = text(formData, "id");
  if (!id) return { error: "Unidad inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("units").delete().eq("id", id);
  // 23503: la unidad tiene paquetes o reservas asociados.
  if (error?.code === "23503") {
    return { error: "No se puede eliminar: tiene paquetes o reservas registrados." };
  }
  if (error) return { error: "No se pudo eliminar la unidad." };

  revalidatePath("/admin/unidades");
  return { ok: "Unidad eliminada." };
}
