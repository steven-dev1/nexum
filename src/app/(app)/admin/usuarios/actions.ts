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
  const role = text(formData, "role") as Role;
  const unitId = text(formData, "unit_id") || null;
  if (!id) return { error: "Usuario inválido." };

  // Evita que un administrador se quite a sí mismo el rol y deje el conjunto sin admin.
  // (El select de su propia fila va deshabilitado, así que no envía `role`.)
  const patch: { role?: Role; unit_id: string | null } = { unit_id: unitId };
  if (id !== me.id) {
    if (!ROLES.includes(role)) return { error: "Rol inválido." };
    patch.role = role;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select("id");
  if (error || !data || data.length === 0) {
    return { error: "No se pudo actualizar el usuario." };
  }

  revalidatePath("/admin/usuarios");
  return { ok: "Guardado." };
}
