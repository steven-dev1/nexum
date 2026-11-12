"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import { bogotaToIso } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";
import { fmtDateTime } from "@/lib/format";
import { syncAttachments } from "@/lib/attachments";
import { pushInBackground, residentsOfAudience, sendPush } from "@/lib/push";
import { REMINDERS, isReminderKey } from "./reminders";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const STATUSES = ["programada", "en_curso", "finalizada", "cancelada"] as const;
type Status = (typeof STATUSES)[number];

/** Lee y valida los campos comunes de crear/editar. */
function readAssembly(formData: FormData) {
  const title = text(formData, "title");
  const date = text(formData, "date");
  const time = text(formData, "time");
  if (!title || !date || !time) return { error: "Completa título, fecha y hora." } as const;

  return {
    title,
    scheduledAt: bogotaToIso(date, time),
    row: {
      title,
      kind: text(formData, "kind") === "extraordinaria" ? "extraordinaria" : "ordinaria",
      description: text(formData, "description") || null,
      scheduled_at: bogotaToIso(date, time),
      location: text(formData, "location") || null,
      meeting_url: text(formData, "meeting_url") || null,
    },
    reminderKeys: (formData.getAll("reminders") as string[]).filter(isReminderKey),
  } as const;
}

/** Filas de recordatorio futuras para una asamblea. */
function buildReminders(assemblyId: string, title: string, scheduledAt: string, keys: string[]) {
  const scheduled = Date.parse(scheduledAt);
  return keys
    .filter(isReminderKey)
    .map((k) => ({
      assembly_id: assemblyId,
      remind_at: new Date(scheduled - REMINDERS[k].ms).toISOString(),
      message: `Asamblea "${title}" ${REMINDERS[k].label}.`,
    }))
    .filter((r) => Date.parse(r.remind_at) > Date.now());
}

export async function createAssembly(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración convoca asambleas." };

  const parsed = readAssembly(formData);
  if ("error" in parsed) return { error: parsed.error };
  if (Date.parse(parsed.scheduledAt) <= Date.now()) return { error: "La fecha debe ser a futuro." };

  const supabase = await createClient();
  const { data: assembly, error } = await supabase.from("assemblies").insert(parsed.row).select("id").single();
  if (error || !assembly) return { error: "No se pudo crear la asamblea." };

  const attachError = await syncAttachments(supabase, { assembly_id: assembly.id }, formData);
  const reminders = buildReminders(assembly.id, parsed.title, parsed.scheduledAt, parsed.reminderKeys);
  if (reminders.length > 0) {
    const { error: remindersError } = await supabase.from("assembly_reminders").insert(reminders);
    if (remindersError) {
      revalidatePath("/asambleas");
      return { error: "La asamblea se creó, pero no se pudieron programar los recordatorios." };
    }
  }

  pushInBackground(async () =>
    sendPush(supabase, await residentsOfAudience(supabase), {
      title: "Nueva asamblea",
      body: `${parsed.title} · ${fmtDateTime(parsed.scheduledAt)}`,
      url: "/asambleas",
      tag: `asamblea-${assembly.id}`,
    }),
  );

  revalidatePath("/asambleas");
  revalidatePath("/");
  if (attachError) return { error: `La asamblea se convocó, pero ${attachError.toLowerCase()}` };
  return { ok: "Asamblea convocada." };
}

/** Edita la asamblea y reprograma sus recordatorios pendientes (los ya enviados se conservan). */
export async function updateAssembly(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración edita asambleas." };

  const id = text(formData, "id");
  if (!id) return { error: "Asamblea inválida." };

  const parsed = readAssembly(formData);
  if ("error" in parsed) return { error: parsed.error };

  const statusValue = text(formData, "status");
  const status: Status = (STATUSES as readonly string[]).includes(statusValue) ? (statusValue as Status) : "programada";
  if (status === "programada" && Date.parse(parsed.scheduledAt) <= Date.now()) {
    return { error: "Una asamblea programada debe tener fecha a futuro. Si ya se realizó, márcala como finalizada." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assemblies")
    .update({ ...parsed.row, status })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) return { error: "No se pudo guardar la asamblea." };

  const attachError = await syncAttachments(supabase, { assembly_id: id }, formData);

  const { error: deleteError } = await supabase
    .from("assembly_reminders")
    .delete()
    .eq("assembly_id", id)
    .is("sent_at", null);
  const reminders =
    status === "programada" ? buildReminders(id, parsed.title, parsed.scheduledAt, parsed.reminderKeys) : [];
  const { error: insertError } =
    reminders.length > 0 ? await supabase.from("assembly_reminders").insert(reminders) : { error: null };

  revalidatePath("/asambleas");
  revalidatePath("/");
  if (deleteError || insertError) {
    return { error: "La asamblea se guardó, pero no se pudieron reprogramar los recordatorios." };
  }
  if (attachError) return { error: `La asamblea se guardó, pero ${attachError.toLowerCase()}` };
  return { ok: "Asamblea actualizada." };
}

export async function cancelAssembly(formData: FormData) {
  const profile = await getProfile();
  if (!isAdmin(profile)) throw new Error("Sin permiso");

  const id = text(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("assemblies").update({ status: "cancelada" }).eq("id", id);
  if (error) throw new Error("No se pudo cancelar la asamblea");

  // Una asamblea cancelada no debe enviar recordatorios.
  await supabase.from("assembly_reminders").delete().eq("assembly_id", id).is("sent_at", null);

  revalidatePath("/asambleas");
  revalidatePath("/");
}
