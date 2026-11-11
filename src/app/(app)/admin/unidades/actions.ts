"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const MAX_UNITS = 300;

/** "101, 102 201-205" → ["101","102","201","202","203","204","205"] */
function parseNumbers(input: string): string[] | null {
  const out = new Set<string>();
  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to < from || to - from + 1 > MAX_UNITS) return null;
      for (let n = from; n <= to; n++) out.add(String(n));
    } else {
      out.add(token);
    }
    if (out.size > MAX_UNITS) return null;
  }
  return [...out];
}

export async function createUnits(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getProfile();
  if (!isAdmin(me)) return { error: "Solo la administración gestiona unidades." };

  const tower = text(formData, "tower");
  const numbers = parseNumbers(text(formData, "numbers"));
  if (!numbers || numbers.length === 0) {
    return { error: `Escribe los apartamentos (ej. 101, 102 o 101-110). Máximo ${MAX_UNITS} a la vez.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .upsert(
      numbers.map((number) => ({ tower, number })),
      { onConflict: "tower,number", ignoreDuplicates: true },
    );
  if (error) return { error: "No se pudieron crear las unidades." };

  revalidatePath("/admin/unidades");
  return { ok: `${numbers.length} unidades procesadas (las que ya existían se omiten).` };
}

export async function deleteUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getProfile();
  if (!isAdmin(me)) return { error: "Sin permiso." };

  const id = text(formData, "id");
  if (!id) return { error: "Unidad inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("units").delete().eq("id", id);
  // 23503: la unidad tiene paquetes o reservas asociados.
  if (error?.code === "23503") return { error: "Tiene paquetes o reservas asociados." };
  if (error) return { error: "No se pudo eliminar." };

  revalidatePath("/admin/unidades");
  return { ok: "Eliminada." };
}
