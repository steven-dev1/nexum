"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Select } from "@/components/select";
import { Field, inputCls, labelCls } from "@/components/ui";
import { generateUnits } from "@/lib/unit-generator";
import { unitFullLabel } from "@/lib/units";
import { createUnits } from "./actions";

const STYLES = [
  { value: "piso-consecutivo", label: "Piso y consecutivo", hint: "101, 102, 103… 201, 202…" },
  { value: "piso-letra", label: "Piso y letra", hint: "1A, 1B, 1C… 2A, 2B…" },
  { value: "corrido", label: "Corrido", hint: "1, 2, 3… sin importar el piso" },
];

/**
 * Crea unidades describiendo la organización real del conjunto: por pisos (torres, edificios)
 * o por lista libre (casas, locales, parqueaderos). Muestra una vista previa antes de crear.
 */
export function CreateUnitsForm() {
  const [mode, setMode] = useState<"pisos" | "lista">("pisos");
  const [tower, setTower] = useState("");
  const [prefix, setPrefix] = useState("");
  const [floorFrom, setFloorFrom] = useState("1");
  const [floorTo, setFloorTo] = useState("5");
  const [perFloor, setPerFloor] = useState("4");
  const [style, setStyle] = useState("piso-consecutivo");
  const [numbers, setNumbers] = useState("");
  const [floor, setFloor] = useState("");

  const preview = useMemo(
    () => generateUnits({ mode, tower, prefix, floorFrom, floorTo, perFloor, style, numbers, floor }),
    [mode, tower, prefix, floorFrom, floorTo, perFloor, style, numbers, floor],
  );

  const seg = (active: boolean) =>
    `flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-primary text-on-primary" : "text-muted hover:bg-surface hover:text-ink"
    }`;

  return (
    <ActionForm action={createUnits} submitLabel="Crear unidades" pendingLabel="Creando…" variant="accent">
      <input type="hidden" name="mode" value={mode} />

      <div role="group" aria-label="Forma de crear" className="flex gap-1 rounded-xl bg-surface-2 p-1">
        <button
          type="button"
          aria-pressed={mode === "pisos"}
          onClick={() => setMode("pisos")}
          className={seg(mode === "pisos")}
        >
          Por pisos
        </button>
        <button
          type="button"
          aria-pressed={mode === "lista"}
          onClick={() => setMode("lista")}
          className={seg(mode === "lista")}
        >
          Lista libre
        </button>
      </div>
      <p className="-mt-2 text-xs leading-5 text-muted">
        {mode === "pisos"
          ? "Para torres o edificios: indicas los pisos y cuántas unidades hay por piso."
          : "Para casas, locales o parqueaderos: escribes los números o un rango (1-40)."}
      </p>

      <Field
        label="Torre / bloque / manzana"
        hint="Déjalo vacío si el conjunto no tiene grupos. Ej.: 1, A, Manzana B, Bloque Norte."
      >
        <input
          name="tower"
          value={tower}
          onChange={(e) => setTower(e.target.value)}
          maxLength={40}
          className={inputCls}
          autoFocus
        />
      </Field>

      {mode === "pisos" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Piso inicial">
              <input
                name="floor_from"
                type="number"
                min={-10}
                max={200}
                inputMode="numeric"
                required
                value={floorFrom}
                onChange={(e) => setFloorFrom(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Piso final">
              <input
                name="floor_to"
                type="number"
                min={-10}
                max={200}
                inputMode="numeric"
                required
                value={floorTo}
                onChange={(e) => setFloorTo(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Por piso">
              <input
                name="per_floor"
                type="number"
                min={1}
                max={99}
                inputMode="numeric"
                required
                value={perFloor}
                onChange={(e) => setPerFloor(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Select label="Numeración" name="style" value={style} onChange={setStyle} options={STYLES} />
        </>
      ) : (
        <>
          <Field
            label="Números"
            hint={
              <>
                Separa con comas o espacios. Un rango como <span className="font-mono text-ink">1-40</span> crea las
                cuarenta de una vez.
              </>
            }
          >
            <textarea
              name="numbers"
              rows={2}
              required
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              placeholder="1-40  ó  101, 102, 201-210"
              className={inputCls}
            />
          </Field>
          <Field label="Piso (opcional)" hint="Solo si todas están en el mismo piso.">
            <input
              name="floor"
              type="number"
              min={-10}
              max={200}
              inputMode="numeric"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className={inputCls}
            />
          </Field>
        </>
      )}

      <Field
        label="Prefijo (opcional)"
        hint="Se antepone al número: «Casa » → «Casa 12», «A-» → «A-101». Sin prefijo, un número se muestra como «Apto 101»."
      >
        <input
          name="prefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          maxLength={12}
          placeholder="Casa , Local , A-"
          className={inputCls}
        />
      </Field>

      <div className="rounded-xl border border-line bg-bg px-3.5 py-3">
        <span className={labelCls}>Vista previa</span>
        {"error" in preview ? (
          <p className="text-sm text-muted">{preview.error}</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">
              Se crearán {preview.units.length} unidad{preview.units.length === 1 ? "" : "es"}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              {preview.units
                .slice(0, 3)
                .map((u) => unitFullLabel(u))
                .join(" · ")}
              {preview.units.length > 4 && " … "}
              {preview.units.length > 3 && ` ${unitFullLabel(preview.units[preview.units.length - 1])}`}
            </p>
          </>
        )}
      </div>
    </ActionForm>
  );
}
