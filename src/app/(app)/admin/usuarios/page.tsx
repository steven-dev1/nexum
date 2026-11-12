import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, ContentSkeleton, Empty } from "@/components/ui";
import { getProfile, type Role } from "@/lib/auth";
import { fmtDateShort } from "@/lib/format";
import { unitOptions } from "@/lib/options";
import { createClient } from "@/lib/supabase/server";
import { unitFullLabel } from "@/lib/units";
import { UsersTable, type UserView } from "./users-table";
import { UsersToolbar, type RoleFilter } from "./users-toolbar";

export const metadata: Metadata = { title: "Usuarios" };

const PAGE_SIZE = 25;
const FILTERS: RoleFilter[] = ["todos", "residente", "porteria", "admin", "sin-unidad"];

export default function UsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <UsuariosContent searchParams={searchParams} />
    </Suspense>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Quita los caracteres que tienen significado en los filtros de PostgREST (coma, paréntesis, comodines). */
const cleanSearch = (s: string) =>
  s
    .replace(/[%,()*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

async function UsuariosContent({ searchParams }: { searchParams: PageProps<"/admin/usuarios">["searchParams"] }) {
  const params = await searchParams;
  const q = cleanSearch(first(params.q));
  const rolParam = first(params.rol) as RoleFilter;
  const rol: RoleFilter = FILTERS.includes(rolParam) ? rolParam : "todos";
  const page = Math.max(1, Number.parseInt(first(params.pagina), 10) || 1);

  const me = await getProfile();
  const supabase = await createClient();

  const head = () => supabase.from("profiles").select("id", { count: "exact", head: true });

  let list = supabase
    .from("profiles")
    .select("id, full_name, email, role, unit_id, created_at, units(tower, number)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (rol === "residente" || rol === "porteria" || rol === "admin") list = list.eq("role", rol);
  if (rol === "sin-unidad") list = list.eq("role", "residente").is("unit_id", null);
  if (q) list = list.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

  const [listRes, all, residents, staff, admins, noUnit, unitsRes] = await Promise.all([
    list,
    head(),
    head().eq("role", "residente"),
    head().eq("role", "porteria"),
    head().eq("role", "admin"),
    head().eq("role", "residente").is("unit_id", null),
    supabase.from("units").select("id, tower, number").order("tower").order("number"),
  ]);

  const counts: Record<RoleFilter, number> = {
    todos: all.count ?? 0,
    residente: residents.count ?? 0,
    porteria: staff.count ?? 0,
    admin: admins.count ?? 0,
    "sin-unidad": noUnit.count ?? 0,
  };

  const total = listRes.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const users: UserView[] = (listRes.data ?? []).map((u) => {
    const unit = (Array.isArray(u.units) ? u.units[0] : u.units) as { tower: string; number: string } | null;
    return {
      id: u.id,
      name: u.full_name,
      email: u.email,
      role: u.role as Role,
      unitId: u.unit_id,
      unitLabel: unit ? unitFullLabel(unit) : null,
      registered: fmtDateShort(u.created_at),
      isMe: u.id === me.id,
    };
  });

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (rol !== "todos") sp.set("rol", rol);
    if (p > 1) sp.set("pagina", String(p));
    return sp.size ? `?${sp}` : "?";
  };

  return (
    <div className="space-y-4">
      <UsersToolbar q={q} rol={rol} counts={counts} />

      {counts["sin-unidad"] > 0 && rol !== "sin-unidad" && (
        <p className="rounded-xl border border-line bg-accent-soft px-4 py-2.5 text-sm text-ink">
          Hay <b>{counts["sin-unidad"]}</b> residente{counts["sin-unidad"] === 1 ? "" : "s"} sin unidad: no ven nada del
          conjunto. Asígnales una unidad o{" "}
          <Link
            href="/admin/invitaciones"
            className="font-semibold text-primary-ink underline-offset-2 hover:underline"
          >
            envía una invitación
          </Link>
          .
        </p>
      )}

      <Card className="!p-0">
        {users.length === 0 ? (
          <div className="p-5">
            <Empty>{q || rol !== "todos" ? "Ningún usuario coincide con la búsqueda." : "Aún no hay usuarios."}</Empty>
          </div>
        ) : (
          <div className="py-3">
            <UsersTable users={users} unitOptions={unitOptions(unitsRes.data ?? [])} />
          </div>
        )}
      </Card>

      {total > 0 && (
        <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
          </p>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <PageLink to={page - 1} disabled={page <= 1} href={href(page - 1)} label="Anterior" />
              <span className="px-2 font-medium text-ink">
                Página {page} de {pages}
              </span>
              <PageLink to={page + 1} disabled={page >= pages} href={href(page + 1)} label="Siguiente" />
            </div>
          )}
        </nav>
      )}
    </div>
  );
}

function PageLink({ disabled, href, label }: { to: number; disabled: boolean; href: string; label: string }) {
  const cls =
    "rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold transition-colors " +
    (disabled ? "cursor-not-allowed opacity-40" : "text-ink hover:bg-surface-2");
  return disabled ? (
    <span aria-disabled className={cls}>
      {label}
    </span>
  ) : (
    <Link href={href} scroll={false} className={cls}>
      {label}
    </Link>
  );
}
