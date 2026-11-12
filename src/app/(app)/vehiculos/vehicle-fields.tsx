"use client";

import { useState } from "react";
import { Select, type SelectOption } from "@/components/select";
import { Field, inputCls } from "@/components/ui";
import { normalizePlate } from "@/lib/plate";

export type VehicleDefaults = {
  plate?: string;
  kind?: string;
  brand?: string;
  color?: string;
  active?: boolean;
  unitId?: string;
};

/** Campos de un vehículo (registrar o editar). La placa se normaliza mientras se escribe. */
export function VehicleFields({
  defaults = {},
  unitOptions,
  editing = false,
}: {
  defaults?: VehicleDefaults;
  /** Solo administración al registrar: a qué unidad pertenece. */
  unitOptions?: SelectOption[];
  editing?: boolean;
}) {
  const [plate, setPlate] = useState(defaults.plate ?? "");

  return (
    <>
      <Field label="Placa" hint="Carro: ABC123 · Moto: ABC12D">
        <input
          name="plate"
          required
          value={plate}
          onChange={(e) => setPlate(normalizePlate(e.target.value).slice(0, 6))}
          placeholder="ABC123"
          maxLength={7}
          autoComplete="off"
          autoCapitalize="characters"
          autoFocus
          className={`${inputCls} font-mono uppercase tracking-widest`}
        />
      </Field>
      <Select
        label="Tipo"
        name="kind"
        required
        defaultValue={defaults.kind ?? "carro"}
        options={[
          { value: "carro", label: "Carro" },
          { value: "moto", label: "Moto" },
          { value: "otro", label: "Otro" },
        ]}
      />
      {unitOptions && !editing && (
        <Select label="Unidad" name="unit_id" required placeholder="Elige la unidad" options={unitOptions} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marca (opcional)">
          <input name="brand" maxLength={60} defaultValue={defaults.brand} placeholder="Mazda" className={inputCls} />
        </Field>
        <Field label="Color (opcional)">
          <input name="color" maxLength={40} defaultValue={defaults.color} placeholder="Gris" className={inputCls} />
        </Field>
      </div>
      {editing && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaults.active ?? true}
            className="size-4 accent-[var(--primary)]"
          />
          Activo (si lo desactivas, portería no le dará ingreso)
        </label>
      )}
    </>
  );
}
