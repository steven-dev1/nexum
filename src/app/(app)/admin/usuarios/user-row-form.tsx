"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Select, type SelectOption } from "@/components/select";
import { btnGhost, btnSm } from "@/components/ui";
import type { Role } from "@/lib/auth";
import { updateUser } from "./actions";

const ROLE_OPTIONS: SelectOption[] = [
  { value: "residente", label: "Residente", hint: "Vive en una unidad" },
  { value: "porteria", label: "Portería", hint: "Registra y entrega paquetes" },
  { value: "admin", label: "Administración", hint: "Gestiona todo el conjunto" },
];

/** Fila editable: la unidad solo aplica a residentes. */
export function UserRowForm({
  id,
  role: initialRole,
  unitId,
  unitOptions,
}: {
  id: string;
  role: Role;
  unitId: string | null;
  unitOptions: SelectOption[];
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const resident = role === "residente";

  return (
    <ActionForm
      action={updateUser}
      submitLabel="Guardar"
      pendingLabel="…"
      className="mt-3 flex flex-wrap items-center gap-2"
      buttonClassName={`${btnGhost} ${btnSm}`}
    >
      <input type="hidden" name="id" value={id} />
      <Select
        name="role"
        aria-label="Rol"
        size="sm"
        className="w-44"
        value={role}
        onChange={(v) => setRole(v as Role)}
        options={ROLE_OPTIONS}
      />
      {resident ? (
        <Select
          name="unit_id"
          aria-label="Unidad"
          size="sm"
          className="w-56"
          defaultValue={unitId ?? ""}
          placeholder="Sin unidad"
          options={[{ value: "", label: "Sin unidad" }, ...unitOptions]}
        />
      ) : (
        <span className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">
          Personal del conjunto · sin unidad
        </span>
      )}
    </ActionForm>
  );
}
