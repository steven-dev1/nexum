import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, Card, ContentSkeleton, Empty } from "@/components/ui";
import { getProfile, roleLabel, type Role } from "@/lib/auth";
import { unitOptions } from "@/lib/options";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { UserRowForm } from "./user-row-form";

export const metadata: Metadata = { title: "Usuarios" };

type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  unit_id: string | null;
  created_at: string;
};

export default function UsuariosPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <UsuariosContent />
    </Suspense>
  );
}

async function UsuariosContent() {
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
  const units = unitOptions(unitsRes.data ?? []);
  const withoutUnit = users.filter((u) => u.role === "residente" && !u.unit_id).length;

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-ink">{users.length} usuarios</h2>
        {withoutUnit > 0 && <Badge tone="accent">{withoutUnit} residentes sin unidad</Badge>}
      </div>
      <p className="mb-4 text-sm text-muted">
        Los residentes necesitan una unidad para reservar y recibir paquetes. Administración y portería no tienen unidad.
      </p>

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

                {isMe ? (
                  <p className="mt-2 text-xs text-muted">No puedes cambiar tu propio rol.</p>
                ) : (
                  <UserRowForm id={u.id} role={u.role} unitId={u.unit_id} unitOptions={units} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
