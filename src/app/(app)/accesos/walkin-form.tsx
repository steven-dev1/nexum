"use client";

import { useState } from "react";
import { Select, type SelectOption } from "@/components/select";
import { Field, inputCls } from "@/components/ui";
import { normalizePlate } from "@/lib/plate";
import { VISIT_KINDS } from "@/lib/visits";

/** Campos para registrar a quien llega sin aviso previo. */
export function WalkinFields({ unitOptions }: { unitOptions: SelectOption[] }) {
  const [plate, setPlate] = useState("");

  return (
    <>
      <Select label="Unidad que visita" name="unit_id" required placeholder="Elige la unidad…" options={unitOptions} autoFocus />
      <Field label="Nombre del visitante">
        <input name="visitor_name" required maxLength={120} placeholder="Nombre completo" className={inputCls} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Tipo"
          name="kind"
          required
          defaultValue="visita"
          options={VISIT_KINDS.map((k) => ({ value: k.value, label: k.label, hint: k.hint }))}
        />
        <Field label="Documento (opcional)" hint="Solo lo ve el personal; se borra a los 90 días.">
          <input name="document" maxLength={30} inputMode="numeric" placeholder="Cédula" className={inputCls} />
        </Field>
      </div>
      <Field label="Placa del vehículo (opcional)">
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
      <Select
        label="Cómo ingresa"
        name="intent"
        required
        defaultValue="pedir"
        options={[
          { value: "pedir", label: "Pedir autorización al residente", hint: "El residente recibe un aviso y decide" },
          { value: "directo", label: "Ingreso directo", hint: "El residente ya avisó (llamada, mensaje…)" },
        ]}
      />
    </>
  );
}
