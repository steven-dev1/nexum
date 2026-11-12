"use client";

import { useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Select } from "@/components/select";
import { TimePicker } from "@/components/time-picker";
import { btnGhost, btnSm, Field, inputCls, labelCls } from "@/components/ui";
import { todayBogota } from "@/lib/format";

const MAX_OPTIONS = 10;

/** Campos para crear una votación: pregunta, opciones, tipo de voto y cierre opcional. */
export function PollFields() {
  const [options, setOptions] = useState(["Sí", "No", "Me abstengo"]);

  return (
    <>
      <Field label="Pregunta">
        <input
          name="question"
          required
          minLength={3}
          maxLength={300}
          placeholder="¿Aprueba el presupuesto 2027?"
          className={inputCls}
          autoFocus
        />
      </Field>
      <Field label="Descripción (opcional)">
        <textarea name="description" rows={3} maxLength={2000} className={inputCls} />
      </Field>

      <div>
        <span className={labelCls}>Opciones</span>
        <ul className="space-y-2">
          {options.map((value, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                name="option"
                value={value}
                onChange={(e) => setOptions((o) => o.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={120}
                aria-label={`Opción ${i + 1}`}
                placeholder={`Opción ${i + 1}`}
                className={inputCls}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions((o) => o.filter((_, j) => j !== i))}
                  className={`${btnGhost} ${btnSm} shrink-0`}
                  aria-label={`Quitar la opción ${i + 1}`}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
        {options.length < MAX_OPTIONS && (
          <button type="button" onClick={() => setOptions((o) => [...o, ""])} className={`${btnGhost} ${btnSm} mt-2`}>
            + Agregar opción
          </button>
        )}
      </div>

      <Select
        label="Tipo de voto"
        name="mode"
        required
        defaultValue="secreta"
        options={[
          { value: "secreta", label: "Secreto", hint: "Nadie ve cómo votó cada unidad" },
          { value: "nominal", label: "Nominal", hint: "La administración ve el voto de cada unidad" },
        ]}
      />

      <div>
        <span className={labelCls}>Cierre automático (opcional)</span>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <DatePicker name="closes_date" min={todayBogota()} />
          <TimePicker name="closes_time" step={15} />
        </div>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          Sin fecha, la votación queda abierta hasta que la cierres. Una hora antes del cierre se avisa a quienes aún no
          han votado.
        </p>
      </div>
    </>
  );
}
