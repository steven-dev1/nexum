"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isStaff } from "@/lib/auth";
import { bogotaToIso } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function createReservation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!profile.unitId) {
    return { error: "Tu usuario aún no tiene una unidad asignada. Pídele a la administración que la asigne." };
  }

  const amenityId = text(formData, "amenity_id");
  const date = text(formData, "date");
  const start = text(formData, "start");
  const end = text(formData, "end");
  if (!amenityId || !date || !start || !end) return { error: "Completa zona, fecha y horario." };
  if (end <= start) return { error: "La hora de fin debe ser posterior a la de inicio." };

  const supabase = await createClient();
  const { error } = await supabase.from("reservations").insert({
    amenity_id: amenityId,
    unit_id: profile.unitId,
    starts_at: bogotaToIso(date, start),
    ends_at: bogotaToIso(date, end),
    notes: text(formData, "notes") || null,
  });

  if (error) {
    // 23P01: exclusion_violation (cruce con otra reserva). P0001: reglas de la zona.
    if (error.code === "23P01") return { error: "Ese horario ya está reservado. Elige otro." };
    if (error.code === "P0001") return { error: error.message };
    return { error: "No se pudo crear la reserva. Intenta de nuevo." };
  }

  revalidatePath("/reservas");
  revalidatePath("/");
  return { ok: "Reserva confirmada." };
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
