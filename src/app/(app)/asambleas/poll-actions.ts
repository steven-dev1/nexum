"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getProfile, isAdmin } from "@/lib/auth";
import { bogotaToIso } from "@/lib/format";
import { pushInBackground, residentsOfAudience, sendPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

const MAX_POLL_OPTIONS = 10;

function refresh() {
  revalidatePath("/asambleas");
  revalidatePath("/");
}

/** Crea una votación dentro de una asamblea y avisa a todos los residentes. */
export async function createPoll(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración crea votaciones." };

  const assemblyId = text(formData, "assembly_id");
  const question = text(formData, "question");
  const description = text(formData, "description");
  const mode = text(formData, "mode") === "nominal" ? "nominal" : "secreta";
  if (!assemblyId) return { error: "Asamblea inválida." };
  if (question.length < 3 || question.length > 300) return { error: "Escribe la pregunta (entre 3 y 300 caracteres)." };
  if (description.length > 2000) return { error: "La descripción es demasiado larga." };

  const labels = [...new Set((formData.getAll("option") as string[]).map((o) => o.trim()).filter(Boolean))];
  if (labels.length < 2) return { error: "Agrega al menos dos opciones distintas." };
  if (labels.length > MAX_POLL_OPTIONS) return { error: `Máximo ${MAX_POLL_OPTIONS} opciones.` };
  if (labels.some((l) => l.length > 120)) return { error: "Cada opción admite hasta 120 caracteres." };

  let closesAt: string | null = null;
  const date = text(formData, "closes_date");
  const time = text(formData, "closes_time");
  if (date || time) {
    if (!date || !time) return { error: "Para programar el cierre elige fecha y hora." };
    closesAt = bogotaToIso(date, time);
    if (Date.parse(closesAt) <= Date.now()) return { error: "El cierre debe ser a futuro." };
  }

  const supabase = await createClient();
  const { data: poll, error } = await supabase
    .from("polls")
    .insert({ assembly_id: assemblyId, question, description: description || null, mode, closes_at: closesAt })
    .select("id")
    .single();
  if (error || !poll) return { error: "No se pudo crear la votación." };

  const { error: optionsError } = await supabase
    .from("poll_options")
    .insert(labels.map((label, position) => ({ poll_id: poll.id, label, position })));
  if (optionsError) {
    await supabase.from("polls").delete().eq("id", poll.id);
    return { error: "No se pudieron guardar las opciones." };
  }

  pushInBackground(async () =>
    sendPush(supabase, await residentsOfAudience(supabase), {
      title: "Nueva votación",
      body: question,
      url: "/asambleas",
      tag: `votacion-${poll.id}`,
    }),
  );

  refresh();
  return { ok: "Votación abierta." };
}

/** Cierra la votación, publica los resultados y avisa. */
export async function closePoll(formData: FormData) {
  const profile = await getProfile();
  if (!isAdmin(profile)) throw new Error("Sin permiso");
  const id = text(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("polls")
    .update({ status: "cerrada", closed_at: now, results_sent_at: now })
    .eq("id", id)
    .eq("status", "abierta")
    .select("id, question");
  if (error) throw new Error("No se pudo cerrar la votación");

  const poll = data?.[0];
  if (poll) {
    pushInBackground(async () =>
      sendPush(supabase, await residentsOfAudience(supabase), {
        title: "Resultados de la votación",
        body: poll.question,
        url: "/asambleas",
        tag: `votacion-${poll.id}`,
      }),
    );
  }
  refresh();
}

export async function deletePoll(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración elimina votaciones." };
  const id = text(formData, "id");
  if (!id) return { error: "Votación inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("polls").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la votación." };
  refresh();
  return { ok: "Votación eliminada." };
}

const VOTE_ERRORS: Record<string, string> = {
  sin_sesion: "Inicia sesión para votar.",
  sin_unidad: "Solo los residentes con unidad asignada pueden votar.",
  no_existe: "La votación ya no existe.",
  cerrada: "La votación ya cerró.",
  opcion_invalida: "Elige una de las opciones.",
};

/** Registra (o cambia) el voto de la unidad del residente mientras la votación esté abierta. */
export async function castVote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await getProfile();
  const pollId = text(formData, "poll_id");
  const optionId = text(formData, "option_id");
  if (!pollId || !optionId) return { error: "Elige una opción." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cast_vote", { p_poll: pollId, p_option: optionId });
  if (error) return { error: "No se pudo registrar el voto." };
  if (data !== "ok") return { error: VOTE_ERRORS[data] ?? "No se pudo registrar el voto." };

  refresh();
  return { ok: "Voto registrado." };
}
