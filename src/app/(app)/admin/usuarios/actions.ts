"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin, type Role } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

const ROLES: Role[] = ["admin", "porteria", "residente"];
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function updateUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getProfile();
  if (!isAdmin(me)) return { error: "Solo la administración gestiona usuarios." };

  const id = text(formData, "id");
  if (!id) return { error: "Usuario inválido." };

  // Un administrador no puede cambiar su propio rol (evita dejar el conjunto sin admin);
  // el select de su fila va deshabilitado y no envía `role`.
  let role: Role = me.role;
  if (id !== me.id) {
    role = text(formData, "role") as Role;
    if (!ROLES.includes(role)) return { error: "Rol inválido." };
  }

  // Administración y portería no pertenecen a una unidad (también lo exige la BD).
  const unitId = role === "residente" ? text(formData, "unit_id") || null : null;

  const patch: { role?: Role; unit_id: string | null } = { unit_id: unitId };
  if (id !== me.id) patch.role = role;

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select("id");
  if (error || !data || data.length === 0) {
    return { error: "No se pudo actualizar el usuario." };
  }

  revalidatePath("/admin/usuarios");
  return { ok: "Guardado." };
}
