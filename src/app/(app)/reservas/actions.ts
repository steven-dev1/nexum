"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isStaff } from "@/lib/auth";
import { bogotaToIso } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const DAY_MS = 24 * 3600_000;

/** Lee zona, fecha y horario del formulario. Si la hora de fin es menor, termina al día siguiente. */
function readSlot(formData: FormData): { error: string } | { amenityId: string; startsAt: string; endsAt: string } {
  const amenityId = text(formData, "amenity_id");
  const date = text(formData, "date");
  const start = text(formData, "start");
  const end = text(formData, "end");
  if (!amenityId || !date || !start || !end) return { error: "Completa zona, fecha y horario." };
  if (end === start) return { error: "La hora de inicio y la de fin no pueden ser iguales." };

  const startsAt = bogotaToIso(date, start);
  let endsAt = bogotaToIso(date, end);
  if (end < start) endsAt = new Date(new Date(endsAt).getTime() + DAY_MS).toISOString();
  return { amenityId, startsAt, endsAt };
}

/** Traduce los errores de la base de datos a mensajes para el usuario. */
function dbError(error: { code?: string; message: string }, fallback: string): ActionState {
  // 23P01: exclusion_violation (cruce con otra reserva). P0001: reglas de la zona (trigger).
  if (error.code === "23P01") return { error: "Ese horario ya está reservado. Elige otro." };
  if (error.code === "P0001") return { error: error.message };
  return { error: fallback };
}

export async function createReservation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  const staff = isStaff(profile);

  // El personal reserva a nombre de una unidad; el residente, para la suya.
  const unitId = staff ? text(formData, "unit_id") : profile.unitId;
  if (!unitId) {
    return staff
      ? { error: "Selecciona la unidad para la que es la reserva." }
      : { error: "Tu usuario aún no tiene una unidad asignada. Pídele a la administración que la asigne." };
  }

  const slot = readSlot(formData);
  if ("error" in slot) return slot;

  const supabase = await createClient();
  const { error } = await supabase.from("reservations").insert({
    amenity_id: slot.amenityId,
    unit_id: unitId,
    starts_at: slot.startsAt,
    ends_at: slot.endsAt,
    notes: text(formData, "notes") || null,
  });
  if (error) return dbError(error, "No se pudo crear la reserva. Intenta de nuevo.");

  revalidatePath("/reservas");
  revalidatePath("/");
  return { ok: "Reserva confirmada." };
}

/** Cambia zona, fecha, horario o notas. El residente solo edita las suyas; el personal, cualquiera. */
export async function updateReservation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  const id = text(formData, "id");
  if (!id) return { error: "Reserva inválida." };

  const slot = readSlot(formData);
  if ("error" in slot) return slot;

  const supabase = await createClient();
  let query = supabase
    .from("reservations")
    .update({
      amenity_id: slot.amenityId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      notes: text(formData, "notes") || null,
    })
    .eq("id", id)
    .eq("status", "confirmada");
  if (!isStaff(profile)) query = query.eq("user_id", profile.id);

  const { data, error } = await query.select("id");
  if (error) return dbError(error, "No se pudo actualizar la reserva. Intenta de nuevo.");
  if (!data || data.length === 0) return { error: "No encontramos la reserva o no puedes editarla." };

  revalidatePath("/reservas");
  revalidatePath("/");
  return { ok: "Reserva actualizada." };
}

export async function cancelReservation(formData: FormData) {
  const profile = await getProfile();
  const id = text(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  let query = supabase.from("reservations").update({ status: "cancelada" }).eq("id", id);
  if (!isStaff(profile)) query = query.eq("user_id", profile.id);
  const { error } = await query;
  if (error) throw new Error("No se pudo cancelar la reserva");

  revalidatePath("/reservas");
  revalidatePath("/");
}
