"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Select, type SelectOption } from "@/components/select";
import { Badge, btnGhost, btnSm } from "@/components/ui";
import type { Role } from "@/lib/auth";
import { updateUser } from "./actions";

export type UserView = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  unitId: string | null;
  unitLabel: string | null;
  /** Fecha ya formateada en el servidor (evita diferencias de formato en el navegador). */
  registered: string;
  isMe: boolean;
};

const ROLE_OPTIONS: SelectOption[] = [
  { value: "residente", label: "Residente", hint: "Vive en una unidad" },
  { value: "porteria", label: "Portería", hint: "Registra y entrega paquetes" },
  { value: "admin", label: "Administración", hint: "Gestiona todo el conjunto" },
];

const roleBadge: Record<Role, { label: string; tone: "neutral" | "accent" | "primary" }> = {
  residente: { label: "Residente", tone: "neutral" },
  porteria: { label: "Portería", tone: "primary" },
  admin: { label: "Administración", tone: "accent" },
};

const initial = (u: UserView) => (u.name || u.email || "?").trim().charAt(0).toUpperCase();

/**
 * Lista de usuarios de una página (hasta 25). Cada fila es liviana; el formulario de edición
 * se monta una sola vez, en un único modal compartido, cuando se toca «Editar».
 */
export function UsersTable({ users, unitOptions }: { users: UserView[]; unitOptions: SelectOption[] }) {
  const [editing, setEditing] = useState<UserView | null>(null);

  return (
    <>
      <div className="hidden grid-cols-[minmax(0,2.2fr)_9rem_minmax(0,1.4fr)_7.5rem_4.5rem] gap-4 border-b border-line px-4 pb-2.5 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
        <span>Usuario</span>
        <span>Rol</span>
        <span>Unidad</span>
        <span>Registro</span>
        <span className="sr-only">Acciones</span>
      </div>

      <ul className="divide-y divide-line">
        {users.map((u) => {
          const role = roleBadge[u.role];
          return (
            <li
              key={u.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,2.2fr)_9rem_minmax(0,1.4fr)_7.5rem_4.5rem] md:gap-x-4"
            >
              {/* Usuario */}
              <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                <span
                  aria-hidden
                  className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    u.role === "admin"
                      ? "bg-accent text-accent-ink"
                      : u.role === "porteria"
                        ? "bg-primary text-on-primary"
                        : "bg-primary-soft text-primary-ink"
                  }`}
                >
                  {initial(u)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {u.name || "Sin nombre"} {u.isMe && <Badge tone="primary">Tú</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">{u.email ?? "—"}</p>
                </div>
              </div>

              {/* Acción (en celular va arriba a la derecha) */}
              <div className="order-last col-start-3 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
                {u.isMe ? (
                  <span className="text-xs text-muted">—</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(u)}
                    aria-label={`Editar a ${u.name || u.email}`}
                    className={`${btnGhost} ${btnSm}`}
                  >
                    Editar
                  </button>
                )}
              </div>

              {/* Rol */}
              <div className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-1 pl-12 md:contents">
                <span className="md:block">
                  <Badge tone={role.tone}>{role.label}</Badge>
                </span>
                <span className="text-sm text-ink md:block">
                  {u.unitLabel ??
                    (u.role === "residente" ? (
                      <Badge tone="accent">Sin unidad</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    ))}
                </span>
                <span className="text-xs text-muted md:block">{u.registered}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Editar usuario"
        description={editing ? editing.name || editing.email || undefined : undefined}
        icon="edit"
      >
        {editing && <EditUserForm key={editing.id} user={editing} unitOptions={unitOptions} />}
      </Modal>
    </>
  );
}

function EditUserForm({ user, unitOptions }: { user: UserView; unitOptions: SelectOption[] }) {
  const [role, setRole] = useState<Role>(user.role);

  return (
    <ActionForm action={updateUser} submitLabel="Guardar cambios" pendingLabel="Guardando…">
      <input type="hidden" name="id" value={user.id} />
      <Select
        label="Rol"
        name="role"
        required
        value={role}
        onChange={(v) => setRole(v as Role)}
        options={ROLE_OPTIONS}
      />
      {role === "residente" ? (
        <Select
          label="Unidad"
          name="unit_id"
          placeholder="Sin unidad"
          defaultValue={user.unitId ?? ""}
          options={[{ value: "", label: "Sin unidad" }, ...unitOptions]}
          hint="Sin unidad, la persona no puede ver nada del conjunto."
        />
      ) : (
        <p className="rounded-xl border border-dashed border-line px-3.5 py-3 text-sm text-muted">
          El personal del conjunto no pertenece a una unidad.
        </p>
      )}
    </ActionForm>
  );
}
