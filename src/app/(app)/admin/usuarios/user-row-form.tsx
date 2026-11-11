"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Select, btnGhost, btnSm } from "@/components/ui";
import type { Role } from "@/lib/auth";
import { updateUser } from "./actions";

type Unit = { id: string; label: string };

/** Fila editable: la unidad solo aplica a residentes. */
export function UserRowForm({
  id,
  role: initialRole,
  unitId,
  units,
  isMe,
}: {
  id: string;
  role: Role;
  unitId: string | null;
  units: Unit[];
  isMe: boolean;
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
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        disabled={isMe}
        aria-label="Rol"
        title={isMe ? "No puedes cambiar tu propio rol" : undefined}
        className="!w-auto !py-2 !text-sm"
      >
        <option value="residente">Residente</option>
        <option value="porteria">Portería</option>
        <option value="admin">Administración</option>
      </Select>
      {resident ? (
        <Select name="unit_id" defaultValue={unitId ?? ""} aria-label="Unidad" className="!w-auto !py-2 !text-sm">
          <option value="">Sin unidad</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
      ) : (
        <span className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">
          Personal del conjunto · sin unidad
        </span>
      )}
    </ActionForm>
  );
}
