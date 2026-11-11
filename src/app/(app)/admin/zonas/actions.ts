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

/** Minutos que dura la franja diaria; si cierra antes de abrir, cruza la medianoche. */
function windowMinutes(open: string, close: string) {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const diff = ch * 60 + cm - (oh * 60 + om);
  return diff > 0 ? diff : diff + 24 * 60;
}

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
  if (!open || !close) return { error: "Indica la hora de apertura y de cierre." };
  if (open === close) return { error: "La apertura y el cierre no pueden ser a la misma hora." };
  if (!maxHours || !Number.isInteger(maxHours) || maxHours < 1) {
    return { error: "La duración máxima debe ser de al menos 1 hora." };
  }
  if (maxHours * 60 > windowMinutes(open, close)) {
    return { error: "La duración máxima no puede superar las horas que la zona está abierta." };
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
  return { ok: id ? `«${name}» actualizada.` : `«${name}» creada.` };
}
