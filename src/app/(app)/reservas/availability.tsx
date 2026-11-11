"use client";

import { useMemo, useState } from "react";
import { Calendar, formatDateLong } from "@/components/calendar";
import { Select } from "@/components/select";
import { DaySlots, marksFor } from "./day-slots";
import type { AmenityInfo, Booking } from "./types";

/**
 * Calendario de disponibilidad: días con reservas por zona y franjas ocupadas del día elegido.
 * `today` (YYYY-MM-DD, Colombia) lo calcula el servidor en la petición, para que el
 * render del servidor y el del navegador coincidan.
 */
export function Availability({
  amenities,
  bookings,
  today,
}: {
  amenities: AmenityInfo[];
  bookings: Booking[];
  today: string;
}) {
  const [amenityId, setAmenityId] = useState(amenities[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const amenity = amenities.find((a) => a.id === amenityId);

  const marks = useMemo(() => marksFor(bookings, amenityId), [bookings, amenityId]);
  const dayBookings = useMemo(
    () => bookings.filter((b) => b.amenityId === amenityId && b.date === date),
    [bookings, amenityId, date],
  );

  if (!amenity) return null;

  return (
    <div className="grid gap-5 md:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[18rem]">
        <Select
          name="availability_amenity"
          aria-label="Zona común"
          size="sm"
          className="mb-3"
          value={amenityId}
          onChange={setAmenityId}
          options={amenities.map((a) => ({ value: a.id, label: a.name }))}
        />
        <Calendar value={date} onSelect={setDate} min={today} today={today} marks={marks} />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          Días con reservas
          <span aria-hidden className="ml-3 size-3 rounded ring-1 ring-inset ring-accent" />
          Hoy
        </p>
      </div>

      <div className="self-start rounded-2xl border border-line bg-bg p-4">
        <p suppressHydrationWarning className="text-sm font-bold text-ink">
          {formatDateLong(date)}
        </p>
        <p className="mb-3 text-xs text-muted">{amenity.name}</p>
        <DaySlots amenity={amenity} bookings={dayBookings} />
      </div>
    </div>
  );
}
