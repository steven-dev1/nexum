import "server-only";
import { unitLabel } from "@/lib/auth";
import { bogotaDateTime, hhmm } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";
import type { AmenityInfo, Booking } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AmenityRow = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  deposit_cop: number;
  open_time: string;
  close_time: string;
  max_hours: number;
};

export const amenityColumns = "id, name, description, capacity, deposit_cop, open_time, close_time, max_hours";

export function toAmenityInfo(a: AmenityRow): AmenityInfo {
  return { id: a.id, name: a.name, open: hhmm(a.open_time), close: hhmm(a.close_time), maxHours: a.max_hours };
}

/** Reservas confirmadas desde hoy (hasta 500) en hora de Colombia, para calendarios y validación visual. */
export async function getBookings(supabase: Supabase, { withUnits }: { withUnits: boolean }): Promise<Booking[]> {
  const { data } = await supabase
    .from("reservations")
    .select("id, amenity_id, starts_at, ends_at, units(tower, number)")
    .eq("status", "confirmada")
    .gt("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(500);

  return (data ?? []).map((r) => {
    const start = bogotaDateTime(r.starts_at as string);
    const end = bogotaDateTime(r.ends_at as string);
    const units = r.units as unknown as { tower: string; number: string } | null;
    return {
      id: r.id as string,
      amenityId: r.amenity_id as string,
      date: start.date,
      from: start.time,
      to: end.time,
      overnight: end.date > start.date,
      ...(withUnits ? { unit: unitLabel(units) } : {}),
    };
  });
}
