"use client";

import { useMemo, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Select, type SelectOption } from "@/components/select";
import { TimePicker, formatTime } from "@/components/time-picker";
import { Field, inputCls, labelCls } from "@/components/ui";
import { todayBogota } from "@/lib/format";
import { DaySlots, marksFor } from "./day-slots";
import type { AmenityInfo, Booking } from "./types";

type Defaults = { amenityId?: string; date?: string; start?: string; end?: string; notes?: string };

/**
 * Campos de una reserva (crear o editar). Al elegir zona, el calendario marca
 * los días que ya tienen reservas y, al elegir día, muestra las franjas ocupadas.
 */
export function ReservationFields({
  amenities,
  bookings,
  unitOptions,
  defaults = {},
  excludeId,
}: {
  amenities: AmenityInfo[];
  bookings: Booking[];
  /** Solo para el personal: reservar a nombre de una unidad. */
  unitOptions?: SelectOption[];
  defaults?: Defaults;
  /** Al editar: la propia reserva no cuenta como ocupada. */
  excludeId?: string;
}) {
  const [amenityId, setAmenityId] = useState(defaults.amenityId ?? "");
  const [date, setDate] = useState(defaults.date ?? "");
  const amenity = amenities.find((a) => a.id === amenityId);

  const marks = useMemo(
    () => (amenityId ? marksFor(bookings, amenityId, excludeId) : undefined),
    [bookings, amenityId, excludeId],
  );
  const dayBookings = useMemo(
    () => bookings.filter((b) => b.amenityId === amenityId && b.date === date && b.id !== excludeId),
    [bookings, amenityId, date, excludeId],
  );

  const options: SelectOption[] = amenities.map((a) => ({
    value: a.id,
    label: a.name,
    hint: `${formatTime(a.open)} – ${formatTime(a.close)}${a.close <= a.open ? " (día sig.)" : ""} · máx. ${a.maxHours} h`,
  }));

  return (
    <>
      {unitOptions && (
        <Select
          label="Unidad"
          name="unit_id"
          required
          placeholder="Selecciona la unidad…"
          options={unitOptions}
          autoFocus
        />
      )}
      <Select
        label="Zona común"
        name="amenity_id"
        required
        placeholder="Selecciona la zona…"
        options={options}
        value={amenityId}
        onChange={setAmenityId}
        autoFocus={!unitOptions && !defaults.amenityId}
      />

      <div>
        <span className={labelCls}>Fecha</span>
        <DatePicker
          name="date"
          min={todayBogota()}
          required
          value={date}
          onChange={setDate}
          marks={marks}
          marksLabel="Días con reservas"
        />
        {!amenityId && (
          <span className="mt-1.5 block text-xs text-muted">Elige la zona para ver los días con reservas.</span>
        )}
      </div>

      {amenity && date && (
        <div>
          <span className={labelCls}>Ocupación de ese día</span>
          <DaySlots amenity={amenity} bookings={dayBookings} compact />
        </div>
      )}

      <div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className={labelCls}>Desde</span>
            <TimePicker name="start" required defaultValue={defaults.start} />
          </div>
          <div>
            <span className={labelCls}>Hasta</span>
            <TimePicker name="end" required defaultValue={defaults.end} />
          </div>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          Si la hora de fin es menor que la de inicio, la reserva termina al día siguiente.
        </p>
      </div>

      <Field label="Notas (opcional)">
        <input name="notes" defaultValue={defaults.notes} placeholder="Cumpleaños, reunión…" className={inputCls} />
      </Field>
    </>
  );
}
