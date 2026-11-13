"use server";

import { revalidatePath } from "next/cache";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { isValidPlate, nearMatches, normalizePlate, type Direction } from "@/lib/plate";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { kindLabel } from "@/lib/visits";

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
  /** Foto del vehículo (URL firmada de corta duración), para compararla con el que está en la entrada. */
  photoUrl?: string;
  suggestions?: { plate: string; unit: string }[];
  /** Si la placa tiene un permiso temporal de visita: quién es y hasta cuándo vale. */
  visitLabel?: string;
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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Placa sin vehículo registrado: se busca un permiso temporal (visita con esa placa). Devuelve null si no hay ninguno,
 * para que siga el flujo normal de «placa no registrada».
 */
async function handleVisitPlate(
  supabase: Supabase,
  o: { plate: string; direction: Direction; method: "voz" | "manual"; transcript: string | null; force: boolean },
): Promise<AccessResult | null> {
  const base = { plate: o.plate, direction: o.direction } as const;
  const { data } = await supabase
    .from("visits")
    .select("id, visitor_name, kind, unit_id, status, valid_from, valid_until, units(tower, number)")
    .eq("plate", o.plate)
    .in("status", ["autorizada", "dentro"])
    .order("valid_until", { ascending: false })
    .limit(5);
  if (!data || data.length === 0) return null;

  const now = new Date().getTime();
  const inside = data.find((v) => v.status === "dentro");
  const valid = data.find((v) => v.status === "autorizada" && Date.parse(v.valid_from) <= now && Date.parse(v.valid_until) > now);
  const current = inside ?? valid ?? data[0];
  const unit = unitLabel(current.units as unknown as Joined);
  const visitLabel = `Permiso temporal · ${current.visitor_name} (${kindLabel(current.kind)}) · hasta ${fmtDateTime(current.valid_until)}`;

  const log = async (result: "autorizado" | "inactivo") => {
    const { data: row, error } = await supabase
      .from("vehicle_access_log")
      .insert({
        plate: o.plate,
        direction: o.direction,
        result,
        method: o.method,
        transcript: o.transcript,
        visit_id: current.id,
        unit_id: current.unit_id,
      })
      .select("id")
      .single();
    return error ? undefined : row.id;
  };

  if (o.direction === "ingreso") {
    if (inside && !o.force) {
      return { ...base, status: "confirmar", unit, visitLabel, message: "Este vehículo ya figura dentro del conjunto." };
    }
    if (!valid && !inside) {
      const expired = Date.parse(current.valid_until) <= now;
      const logId = await log("inactivo");
      revalidatePath("/accesos");
      return {
        ...base,
        status: "inactivo",
        unit,
        visitLabel,
        logId,
        message: expired ? "El permiso temporal de este vehículo ya venció." : "El permiso temporal de este vehículo todavía no empieza.",
      };
    }
    if (valid) {
      const { data: res } = await supabase.rpc("check_in_visit", { p_ref: valid.id });
      if ((res as { result?: string } | null)?.result !== "ok") {
        return { ...base, status: "error", message: "No se pudo registrar el ingreso de la visita." };
      }
    }
    const logId = await log("autorizado");
    revalidatePath("/accesos");
    revalidatePath("/visitas");
    return { ...base, status: "autorizado", unit, visitLabel, logId };
  }

  // Salida
  if (!inside) {
    return { ...base, status: "error", unit, visitLabel, message: "Este vehículo con permiso temporal no figura dentro del conjunto." };
  }
  const { data: res } = await supabase.rpc("check_out_visit", { p_id: inside.id });
  if ((res as { result?: string } | null)?.result !== "ok") {
    return { ...base, status: "error", message: "No se pudo registrar la salida de la visita." };
  }
  const logId = await log("autorizado");
  revalidatePath("/accesos");
  revalidatePath("/visitas");
  return { ...base, status: "autorizado", unit, visitLabel, logId };
}

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
    .select("id, kind, brand, color, active, unit_id, photo_path, units(tower, number)")
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
  let photoUrl: string | undefined;
  if (vehicle?.photo_path) {
    const { data: signed } = await supabase.storage.from("vehicle-photos").createSignedUrl(vehicle.photo_path, 600);
    photoUrl = signed?.signedUrl;
  }
  const details = vehicle ? { kind: vehicle.kind, brand: vehicle.brand, color: vehicle.color } : undefined;

  if (!vehicle) {
    const asVisit = await handleVisitPlate(supabase, { plate, direction, method, transcript, force: !!input.force });
    if (asVisit) return asVisit;

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
    return { ...base, status: "inactivo", unit, vehicle: details, photoUrl, logId: logId ?? undefined };
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
      return { ...base, status: "confirmar", unit, vehicle: details, photoUrl, message: "Este vehículo ya figura dentro del conjunto." };
    }
    if (direction === "salida" && last?.direction !== "ingreso") {
      return { ...base, status: "confirmar", unit, vehicle: details, photoUrl, message: "Este vehículo no figura dentro del conjunto." };
    }
  }

  const logId = await log("autorizado");
  if (!logId) return { ...base, status: "error", message: "No se pudo registrar el movimiento." };
  revalidatePath("/accesos");
  return { ...base, status: "autorizado", unit, vehicle: details, photoUrl, logId };
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
