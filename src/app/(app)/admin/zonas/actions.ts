"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const int = (fd: FormData, key: string) => {
  const v = text(fd, key);
  return v === "" ? null : Number(v);
};

/** Crea o actualiza una zona común (si viene `id`, actualiza). */
export async function saveAmenity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getProfile();
  if (!isAdmin(me)) return { error: "Solo la administración gestiona zonas comunes." };

  const id = text(formData, "id");
  const name = text(formData, "name");
  const open = text(formData, "open_time");
  const close = text(formData, "close_time");
  const maxHours = int(formData, "max_hours");
  const deposit = int(formData, "deposit_cop") ?? 0;
  const capacity = int(formData, "capacity");

  if (!name) return { error: "Escribe el nombre de la zona." };
  if (!open || !close || close <= open) return { error: "El cierre debe ser posterior a la apertura." };
  if (!maxHours || !Number.isInteger(maxHours) || maxHours < 1) {
    return { error: "La duración máxima debe ser de al menos 1 hora." };
  }
  if (!Number.isInteger(deposit) || deposit < 0) return { error: "El depósito no puede ser negativo." };
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: "El aforo debe ser un número positivo." };
  }

  const row = {
    name,
    description: text(formData, "description") || null,
    capacity,
    deposit_cop: deposit,
    open_time: open,
    close_time: close,
    max_hours: maxHours,
    active: formData.get("active") === "on",
  };

  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("amenities").update(row).eq("id", id).select("id");
    if (error || !data || data.length === 0) return { error: "No se pudo guardar la zona." };
  } else {
    const { error } = await supabase.from("amenities").insert(row);
    if (error) return { error: "No se pudo crear la zona." };
  }

  revalidatePath("/admin/zonas");
  revalidatePath("/reservas");
  return { ok: id ? "Zona actualizada." : "Zona creada." };
}
