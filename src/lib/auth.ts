import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unitFullLabel } from "@/lib/units";

export type Role = "admin" | "porteria" | "residente";

export type Profile = {
  id: string;
  email: string | null;
  fullName: string;
  role: Role;
  unitId: string | null;
  unitLabel: string | null;
  tower: string | null;
  /** Personal, o residente con unidad. Quien no es miembro aún no puede ver datos del conjunto. */
  isMember: boolean;
};

export const unitLabel = unitFullLabel;

export const roleLabel: Record<Role, string> = {
  admin: "Administración",
  porteria: "Portería",
  residente: "Residente",
};

/**
 * Perfil de la cuenta actual, sea o no miembro (una sola lectura por request).
 * Valida el JWT con getClaims() y redirige a /login si no hay sesión.
 * Úsalo solo en las pantallas de acceso; en el resto, usa `getProfile`.
 */
export const getAccountProfile = cache(async (): Promise<Profile> => {
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

  const role = (row?.role as Role | undefined) ?? "residente";
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    fullName: row?.full_name || (claims.email as string | undefined) || "Usuario",
    role,
    unitId: row?.unit_id ?? null,
    unitLabel: unit ? unitLabel(unit) : null,
    tower: unit?.tower || null,
    isMember: role !== "residente" || !!row?.unit_id,
  };
});

/**
 * Perfil del miembro actual. Quien tiene sesión pero aún no tiene acceso (no canjeó una
 * invitación) va a /acceso. La seguridad real está en la RLS de la base de datos.
 */
export async function getProfile(): Promise<Profile> {
  const profile = await getAccountProfile();
  if (!profile.isMember) redirect("/acceso");
  return profile;
}

export const isStaff = (p: Profile) => p.role === "admin" || p.role === "porteria";
export const isAdmin = (p: Profile) => p.role === "admin";
