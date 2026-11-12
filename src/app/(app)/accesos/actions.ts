"use server";

import { revalidatePath } from "next/cache";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { isValidPlate, nearMatches, normalizePlate, type Direction } from "@/lib/plate";
import { createClient } from "@/lib/supabase/server";

export type AccessStatus =
  | "autorizado"
  | "no_registrada"
  | "inactivo"
  /** Ya figura dentro (o no figura dentro al salir): se pide confirmar antes de registrar. */
  | "confirmar"
  | "error";

export type AccessResult = {
  status: AccessStatus;
  plate: string;
  direction: Direction;
  message?: string;
  logId?: string;
  unit?: string;
  vehicle?: { kind: string; brand: string | null; color: string | null };
  suggestions?: { plate: string; unit: string }[];
};

type Input = {
  plate: string;
  direction: Direction;
  method: "voz" | "manual";
  transcript?: string;
  /** Registrar aunque ya figure dentro / no figure dentro. */
  force?: boolean;
};

type Joined = { tower: string; number: string } | null;

/**
 * Valida la placa y registra el ingreso o la salida en la bitácora. El servidor vuelve a normalizar y validar
 * todo: lo que llega del navegador (voz o teclado) no se da por bueno.
 */
export async function submitPlate(input: Input): Promise<AccessResult> {
  const profile = await getProfile();
  const direction: Direction = input.direction === "salida" ? "salida" : "ingreso";
  const plate = normalizePlate(String(input.plate ?? ""));
  const base = { plate, direction } as const;

  if (!isStaff(profile)) return { ...base, status: "error", message: "Solo portería y administración registran accesos." };
  if (!isValidPlate(plate)) return { ...base, status: "error", message: "La placa no tiene un formato válido (ABC123 o ABC12D)." };

  const method = input.method === "voz" ? "voz" : "manual";
  const transcript = input.transcript ? String(input.transcript).slice(0, 200) : null;
  const supabase = await createClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, kind, brand, color, active, unit_id, units(tower, number)")
    .eq("plate", plate)
    .maybeSingle();

  const log = async (result: "autorizado" | "no_registrada" | "inactivo") => {
    const { data, error } = await supabase
      .from("vehicle_access_log")
      .insert({
        plate,
        direction,
        result,
        method,
        transcript,
        vehicle_id: vehicle?.id ?? null,
        unit_id: vehicle?.unit_id ?? null,
      })
      .select("id")
      .single();
    return error ? null : data.id;
  };

  const unit = vehicle ? unitLabel(vehicle.units as unknown as Joined) : undefined;
  const details = vehicle ? { kind: vehicle.kind, brand: vehicle.brand, color: vehicle.color } : undefined;

  if (!vehicle) {
    // Placas registradas que se parecen (error típico de dictado), para confirmar con un toque.
    const { data: all } = await supabase.from("vehicles").select("plate, units(tower, number)").eq("active", true).limit(3000);
    const near = nearMatches(plate, (all ?? []).map((v) => v.plate));
    const suggestions = (all ?? [])
      .filter((v) => near.includes(v.plate))
      .slice(0, 4)
      .map((v) => ({ plate: v.plate, unit: unitLabel(v.units as unknown as Joined) }));
    const logId = await log("no_registrada");
    revalidatePath("/accesos");
    return { ...base, status: "no_registrada", logId: logId ?? undefined, suggestions };
  }

  if (!vehicle.active) {
    const logId = await log("inactivo");
    revalidatePath("/accesos");
    return { ...base, status: "inactivo", unit, vehicle: details, logId: logId ?? undefined };
  }

  if (!input.force) {
    const { data: last } = await supabase
      .from("vehicle_access_log")
      .select("direction")
      .eq("vehicle_id", vehicle.id)
      .eq("result", "autorizado")
      .is("voided_at", null)
      .order("at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (direction === "ingreso" && last?.direction === "ingreso") {
      return { ...base, status: "confirmar", unit, vehicle: details, message: "Este vehículo ya figura dentro del conjunto." };
    }
    if (direction === "salida" && last?.direction !== "ingreso") {
      return { ...base, status: "confirmar", unit, vehicle: details, message: "Este vehículo no figura dentro del conjunto." };
    }
  }

  const logId = await log("autorizado");
  if (!logId) return { ...base, status: "error", message: "No se pudo registrar el movimiento." };
  revalidatePath("/accesos");
  return { ...base, status: "autorizado", unit, vehicle: details, logId };
}

/** Anula un movimiento registrado (queda en la bitácora marcado como anulado). */
export async function undoAccess(logId: string): Promise<{ ok: boolean }> {
  const profile = await getProfile();
  if (!isStaff(profile) || !logId) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_access_log")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", logId)
    .is("voided_at", null)
    .select("id");
  revalidatePath("/accesos");
  return { ok: !error && !!data && data.length > 0 };
}

export async function undoAccessForm(formData: FormData) {
  await undoAccess(String(formData.get("id") ?? ""));
}
