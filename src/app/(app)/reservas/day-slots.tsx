"use client";

import { formatTime } from "@/components/time-picker";
import type { AmenityInfo, Booking } from "./types";

/** Reservas de una zona en un día: franjas ocupadas o "libre todo el día". */
export function DaySlots({
  amenity,
  bookings,
  compact = false,
}: {
  amenity: AmenityInfo;
  bookings: Booking[];
  compact?: boolean;
}) {
  const hours = `${formatTime(amenity.open)} – ${formatTime(amenity.close)}${amenity.close <= amenity.open ? " (día siguiente)" : ""}`;
  const sorted = [...bookings].sort((a, b) => a.from.localeCompare(b.from));

  if (sorted.length === 0) {
    return (
      <p
        className={`flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm text-success ${compact ? "" : "font-medium"}`}
      >
        <svg
          className="size-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m5 12 5 5L20 7" />
        </svg>
        Libre todo el día · {hours}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Horario de la zona: {hours}</p>
      <ul className="space-y-1.5">
        {sorted.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2 font-semibold text-ink">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-danger" />
              {formatTime(b.from)} – {formatTime(b.to)}
              {b.overnight && <span className="text-xs font-normal text-muted">(día siguiente)</span>}
            </span>
            <span className="truncate text-xs text-muted">{b.unit ?? "Reservado"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cantidad de reservas por día para una zona (para marcar el calendario). */
export function marksFor(bookings: Booking[], amenityId: string, excludeId?: string) {
  const marks: Record<string, number> = {};
  for (const b of bookings) {
    if (b.amenityId !== amenityId || b.id === excludeId) continue;
    marks[b.date] = (marks[b.date] ?? 0) + 1;
  }
  return marks;
}
