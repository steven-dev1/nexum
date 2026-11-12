"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, startTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { useModal } from "@/components/modal";
import { Field, btnAccent, btnDanger, btnGhost, btnSm, inputCls } from "@/components/ui";
import { unitFullLabel } from "@/lib/units";
import { deleteUnit, updateUnit } from "./actions";
import type { UnitView } from "./units-board";

/** Contenido del modal de una unidad: resumen (con invitar, editar y eliminar) o formulario de edición. */
export function UnitModalBody({ unit }: { unit: UnitView }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <EditUnitForm unit={unit} onBack={() => setEditing(false)} />;

  // Solo se ofrece eliminar si no hay residentes ni paquetes (la base de datos lo impediría).
  const removable = unit.residents.length === 0 && unit.pendingPackages === 0;

  return (
    <div className="space-y-4 border-t border-line px-6 py-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Residentes</p>
          <p className="text-2xl font-bold text-ink">{unit.residents.length}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Paquetes por recoger</p>
          <p className="text-2xl font-bold text-ink">{unit.pendingPackages}</p>
        </div>
      </div>

      {unit.residents.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {unit.residents.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink">
                {(r.name || r.email || "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.name || "Sin nombre"}</p>
                <p className="truncate text-xs text-muted">{r.email ?? "—"}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          Nadie vive aquí todavía. Envía una invitación para que la persona cree su cuenta ya vinculada a esta unidad.
        </p>
      )}

      {unit.pendingPackages > 0 && (
        <Link
          href="/paqueteria"
          className="flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-semibold text-ink hover:brightness-95"
        >
          Ver paquetes en portería
          <span aria-hidden>→</span>
        </Link>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={`/admin/invitaciones?unidad=${unit.id}`} className={btnAccent}>
          Invitar residente
        </Link>
        <button type="button" onClick={() => setEditing(true)} className={btnGhost}>
          Editar datos
        </button>
      </div>

      {removable && <DeleteUnit unit={unit} />}
    </div>
  );
}

function EditUnitForm({ unit, onBack }: { unit: UnitView; onBack: () => void }) {
  return (
    <ActionForm action={updateUnit} submitLabel="Guardar cambios" pendingLabel="Guardando…">
      <input type="hidden" name="id" value={unit.id} />
      <button
        type="button"
        onClick={onBack}
        className="-mt-1 inline-flex cursor-pointer items-center gap-1 text-sm font-semibold text-primary-ink hover:underline"
      >
        <span aria-hidden>←</span> Volver
      </button>
      <Field label="Torre / bloque / manzana" hint="Déjalo vacío si no hay grupos. Ej.: 1, A, Manzana B.">
        <input name="tower" defaultValue={unit.tower} maxLength={40} className={inputCls} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Número" hint="Ej.: 302, Casa 12, A-5.">
          <input name="number" required defaultValue={unit.number} maxLength={24} className={inputCls} autoFocus />
        </Field>
        <Field label="Piso (opcional)" hint="Vacío si no aplica.">
          <input
            name="floor"
            type="number"
            min={-10}
            max={200}
            inputMode="numeric"
            defaultValue={unit.floor ?? ""}
            className={inputCls}
          />
        </Field>
      </div>
    </ActionForm>
  );
}

/** Eliminar con confirmación en dos pasos. */
function DeleteUnit({ unit }: { unit: UnitView }) {
  const modal = useModal();
  const [state, action, pending] = useActionState(deleteUnit, null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state?.ok) modal?.succeed(state.ok);
  }, [state, modal]);

  return (
    <div className="border-t border-line pt-4">
      {confirming ? (
        <div className="space-y-2.5">
          <p className="text-sm text-ink">
            ¿Eliminar <b>{unitFullLabel(unit)}</b>? No se puede deshacer.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const data = new FormData();
                data.set("id", unit.id);
                startTransition(() => action(data));
              }}
              className={`${btnDanger} ${btnSm}`}
            >
              {pending ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={`${btnGhost} ${btnSm}`}>
              No
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={`${btnGhost} ${btnSm} !text-danger`}>
          Eliminar unidad
        </button>
      )}
      {state?.error && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}
