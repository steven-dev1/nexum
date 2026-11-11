import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, btnGhost, btnSm, inputCls } from "@/components/ui";
import { getProfile, roleLabel, unitLabel, type Role } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { updateUser } from "./actions";

export const metadata: Metadata = { title: "Usuarios" };

type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  unit_id: string | null;
  created_at: string;
};

export default async function UsuariosPage() {
  const me = await getProfile();
  const supabase = await createClient();

  const [usersRes, unitsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, unit_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("units").select("id, tower, number").order("tower").order("number"),
  ]);

  const users = (usersRes.data ?? []) as UserRow[];
  const units = unitsRes.data ?? [];
  const withoutUnit = users.filter((u) => u.role === "residente" && !u.unit_id).length;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-ink">{users.length} usuarios</h2>
        {withoutUnit > 0 && <Badge tone="accent">{withoutUnit} residentes sin unidad</Badge>}
      </div>

      {users.length === 0 ? (
        <Empty>Aún no hay usuarios registrados.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {users.map((u) => {
            const isMe = u.id === me.id;
            return (
              <li key={u.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {u.full_name || "Sin nombre"} {isMe && <Badge tone="primary">Tú</Badge>}
                    </p>
                    <p className="truncate text-sm text-muted">{u.email ?? "—"}</p>
                    <p className="text-xs text-muted">Registrado {fmtDate(u.created_at)}</p>
                  </div>
                  <Badge tone={u.role === "residente" ? "neutral" : "accent"}>{roleLabel[u.role]}</Badge>
                </div>

                <ActionForm
                  action={updateUser}
                  submitLabel="Guardar"
                  pendingLabel="…"
                  className="mt-3 flex flex-wrap items-center gap-2"
                  buttonClassName={`${btnGhost} ${btnSm}`}
                >
                  <input type="hidden" name="id" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    disabled={isMe}
                    aria-label="Rol"
                    title={isMe ? "No puedes cambiar tu propio rol" : undefined}
                    className={`${inputCls} !w-auto`}
                  >
                    <option value="residente">Residente</option>
                    <option value="porteria">Portería</option>
                    <option value="admin">Administración</option>
                  </select>
                  <select
                    name="unit_id"
                    defaultValue={u.unit_id ?? ""}
                    aria-label="Unidad"
                    className={`${inputCls} !w-auto`}
                  >
                    <option value="">Sin unidad</option>
                    {units.map((un) => (
                      <option key={un.id} value={un.id}>
                        {unitLabel(un)}
                      </option>
                    ))}
                  </select>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
