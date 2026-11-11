import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "porteria" | "residente";

export type Profile = {
  id: string;
  email: string | null;
  fullName: string;
  role: Role;
  unitId: string | null;
  unitLabel: string | null;
  tower: string | null;
};

export function unitLabel(u: { tower?: string | null; number: string } | null | undefined) {
  if (!u) return "Sin unidad";
  return u.tower ? `Torre ${u.tower} · Apto ${u.number}` : `Apto ${u.number}`;
}

export const roleLabel: Record<Role, string> = {
  admin: "Administración",
  porteria: "Portería",
  residente: "Residente",
};

/**
 * Perfil del usuario actual (una sola lectura por request).
 * Valida el JWT con getClaims() y redirige a /login si no hay sesión.
 */
export const getProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select("full_name, role, unit_id, units(tower, number)")
    .eq("id", claims.sub)
    .maybeSingle();

  const unit = (Array.isArray(row?.units) ? row?.units[0] : row?.units) as
    | { tower: string; number: string }
    | null
    | undefined;

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    fullName: row?.full_name || (claims.email as string | undefined) || "Usuario",
    role: (row?.role as Role | undefined) ?? "residente",
    unitId: row?.unit_id ?? null,
    unitLabel: unit ? unitLabel(unit) : null,
    tower: unit?.tower || null,
  };
});

export const isStaff = (p: Profile) => p.role === "admin" || p.role === "porteria";
export const isAdmin = (p: Profile) => p.role === "admin";
