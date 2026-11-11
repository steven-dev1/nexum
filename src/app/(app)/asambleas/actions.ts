"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import { bogotaToIso } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// Recordatorios disponibles: cuánto antes de la asamblea se envían.
const REMINDERS = {
  "7d": { ms: 7 * 24 * 3600_000, label: "en 7 días" },
  "1d": { ms: 24 * 3600_000, label: "mañana" },
  "1h": { ms: 3600_000, label: "en 1 hora" },
} as const;

export async function createAssembly(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración convoca asambleas." };

  const title = text(formData, "title");
  const date = text(formData, "date");
  const time = text(formData, "time");
  if (!title || !date || !time) return { error: "Completa título, fecha y hora." };

  const scheduledAt = bogotaToIso(date, time);
  if (new Date(scheduledAt).getTime() <= Date.now()) return { error: "La fecha debe ser a futuro." };

  const supabase = await createClient();
  const { data: assembly, error } = await supabase
    .from("assemblies")
    .insert({
      title,
      kind: text(formData, "kind") === "extraordinaria" ? "extraordinaria" : "ordinaria",
      description: text(formData, "description") || null,
      scheduled_at: scheduledAt,
      location: text(formData, "location") || null,
      meeting_url: text(formData, "meeting_url") || null,
    })
    .select("id")
    .single();
  if (error || !assembly) return { error: "No se pudo crear la asamblea." };

  const reminders = (formData.getAll("reminders") as string[])
    .filter((k): k is keyof typeof REMINDERS => k in REMINDERS)
    .map((k) => ({
      assembly_id: assembly.id,
      remind_at: new Date(new Date(scheduledAt).getTime() - REMINDERS[k].ms).toISOString(),
      message: `Asamblea "${title}" ${REMINDERS[k].label}.`,
    }))
    .filter((r) => new Date(r.remind_at).getTime() > Date.now());

  if (reminders.length > 0) {
    const { error: remindersError } = await supabase.from("assembly_reminders").insert(reminders);
    if (remindersError) {
      revalidatePath("/asambleas");
      return { error: "La asamblea se creó, pero no se pudieron programar los recordatorios." };
    }
  }

  revalidatePath("/asambleas");
  revalidatePath("/");
  return { ok: "Asamblea convocada." };
}

export async function cancelAssembly(formData: FormData) {
  const profile = await getProfile();
  if (!isAdmin(profile)) throw new Error("Sin permiso");

  const id = text(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("assemblies").update({ status: "cancelada" }).eq("id", id);
  if (error) throw new Error("No se pudo cancelar la asamblea");

  revalidatePath("/asambleas");
  revalidatePath("/");
}
