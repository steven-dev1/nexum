"use client";

import { useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Select } from "@/components/select";
import { TimePicker } from "@/components/time-picker";
import { Field, inputCls, labelCls } from "@/components/ui";
import { todayBogota } from "@/lib/format";
import { normalizePlate } from "@/lib/plate";
import { VISIT_KINDS } from "@/lib/visits";

/** Campos para autorizar una visita: quién, cuándo y, si llega en vehículo, su placa (permiso temporal). */
export function VisitFields({
  defaultDate,
  defaultFrom,
  defaultUntil,
}: {
  defaultDate: string;
  defaultFrom: string;
  defaultUntil: string;
}) {
  const [plate, setPlate] = useState("");

  return (
    <>
      <Field label="Nombre de la visita">
        <input name="visitor_name" required maxLength={120} placeholder="Ana Gómez" className={inputCls} autoFocus />
      </Field>
      <Select
        label="Tipo"
        name="kind"
        required
        defaultValue="visita"
        options={VISIT_KINDS.map((k) => ({ value: k.value, label: k.label, hint: k.hint }))}
      />

      <div>
        <span className={labelCls}>Fecha</span>
        <DatePicker name="date" min={todayBogota()} required defaultValue={defaultDate} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Desde</span>
          <TimePicker name="from" required step={15} defaultValue={defaultFrom} />
        </div>
        <div>
          <span className={labelCls}>Hasta</span>
          <TimePicker name="until" required step={15} defaultValue={defaultUntil} />
        </div>
      </div>
      <p className="-mt-2 text-xs leading-5 text-muted">
        La autorización solo sirve dentro de este horario. Si la hora final es menor a la inicial, termina al día
        siguiente.
      </p>

      <Field
        label="Placa del vehículo (opcional)"
        hint="Si llega en carro o moto, portería le dará ingreso diciendo la placa. Solo vale en este horario."
      >
        <input
          name="plate"
          value={plate}
          onChange={(e) => setPlate(normalizePlate(e.target.value).slice(0, 6))}
          placeholder="ABC123"
          maxLength={7}
          autoComplete="off"
          autoCapitalize="characters"
          className={`${inputCls} font-mono uppercase tracking-widest`}
        />
      </Field>
      <Field label="Nota para portería (opcional)">
        <input name="notes" maxLength={300} placeholder="Viene a entregar un pedido" className={inputCls} />
      </Field>
    </>
  );
}
