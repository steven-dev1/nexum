"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import { bogotaToIso, fmtDateTime } from "@/lib/format";
import { groupName } from "@/lib/units";
import type { Json } from "@/lib/supabase/database.types";
import type { ActionState } from "@/lib/action-state";
import { purgeAttachments, syncAttachments } from "@/lib/attachments";
import { IMAGE_BUCKET, imagePathsOf, sanitizeDoc } from "@/lib/rich-text";
import { pushInBackground, residentsOfAudience, sendPush } from "@/lib/push";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

type Row = {
  title: string;
  body: string;
  audience: string;
  tower: string | null;
};

/** Cómo se publica: ahora, programado a futuro o borrador. Sin campo (comunicado ya publicado) = «mantener». */
function readPublish(formData: FormData) {
  const mode = text(formData, "publish");
  if (mode === "borrador") return { mode: "borrador" } as const;
  if (mode === "programar") {
    const date = text(formData, "publish_date");
    const time = text(formData, "publish_time");
    if (!date || !time) return { error: "Elige la fecha y la hora de publicación." } as const;
    const at = bogotaToIso(date, time);
    if (Date.parse(at) <= Date.now()) return { error: "La fecha de publicación debe ser a futuro." } as const;
    return { mode: "programar", at } as const;
  }
  if (mode === "ahora") return { mode: "ahora" } as const;
  return { mode: "mantener" } as const;
}

/** Avisa (push) a los destinatarios de un comunicado recién publicado. */
function notifyAnnouncement(supabase: Awaited<ReturnType<typeof createClient>>, id: string, row: Row) {
  pushInBackground(async () =>
    sendPush(supabase, await residentsOfAudience(supabase, row.tower), {
      title: row.audience === "torre" ? `Aviso para ${groupName(row.tower)}` : "Nuevo comunicado",
      body: `${row.title} — ${row.body.replace(/[ \t\r\n]+/g, " ").slice(0, 100)}`,
      url: "/comunicados",
      tag: `comunicado-${id}`,
    }),
  );
}

/** Lee y valida los campos comunes de publicar/editar. */
function readAnnouncement(formData: FormData) {
  const title = text(formData, "title");
  const rich = sanitizeDoc(text(formData, "content"));
  // `target` es "todos" o "torre:<torre>" (un solo desplegable en el formulario).
  const target = text(formData, "target");
  const audience = target.startsWith("torre:") ? "torre" : "todos";
  const tower = audience === "torre" ? target.slice("torre:".length) : "";
  if (!title || !rich || !rich.plain) return { error: "Escribe un título y el mensaje." } as const;
  if (audience === "torre" && !tower) return { error: "Selecciona la torre destinataria." } as const;

  return {
    row: {
      title,
      body: rich.plain,
      content: rich.doc as unknown as Json,
      audience,
      tower: audience === "torre" ? tower : null,
      pinned: formData.get("pinned") === "on",
    },
  } as const;
}

export async function publishAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración publica comunicados." };

  const parsed = readAnnouncement(formData);
  if ("error" in parsed) return { error: parsed.error };
  const publish = readPublish(formData);
  if ("error" in publish) return { error: publish.error };

  const now = new Date().toISOString();
  const state =
    publish.mode === "borrador"
      ? { draft: true, notified_at: null }
      : publish.mode === "programar"
        ? { draft: false, published_at: publish.at, notified_at: null }
        : { draft: false, notified_at: now };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("announcements")
    .insert({ ...parsed.row, ...state })
    .select("id")
    .single();
  if (error || !created) return { error: "No se pudo guardar el comunicado." };
  const attachError = await syncAttachments(supabase, { announcement_id: created.id }, formData);

  if (publish.mode === "ahora") notifyAnnouncement(supabase, created.id, parsed.row);

  revalidatePath("/comunicados");
  revalidatePath("/");
  if (attachError) return { error: `El comunicado se guardó, pero ${attachError.toLowerCase()}` };
  return {
    ok:
      publish.mode === "borrador"
        ? "Borrador guardado."
        : publish.mode === "programar"
          ? `Comunicado programado para el ${fmtDateTime(publish.at)}.`
          : "Comunicado publicado.",
  };
}

export async function updateAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración edita comunicados." };

  const id = text(formData, "id");
  if (!id) return { error: "Comunicado inválido." };

  const parsed = readAnnouncement(formData);
  if ("error" in parsed) return { error: parsed.error };

  const publish = readPublish(formData);
  if ("error" in publish) return { error: publish.error };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("announcements")
    .select("content, draft, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { error: "El comunicado ya no existe." };
  // «Editado» solo si ya lo habían visto los residentes.
  const wasLive = !before.draft && Date.parse(before.published_at) <= Date.now();

  const now = new Date().toISOString();
  const state =
    publish.mode === "borrador"
      ? { draft: true, notified_at: null }
      : publish.mode === "programar"
        ? { draft: false, published_at: publish.at, notified_at: null }
        : publish.mode === "ahora"
          ? { draft: false, published_at: now, notified_at: now }
          : {};
  const { data, error } = await supabase
    .from("announcements")
    .update({ ...parsed.row, ...state, ...(wasLive && publish.mode === "mantener" ? { edited_at: now } : {}) })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) return { error: "No se pudo guardar el comunicado." };

  // Borra del almacenamiento las imágenes que se quitaron del texto.
  const kept = new Set(imagePathsOf(parsed.row.content));
  const removed = imagePathsOf(before?.content).filter((p) => !kept.has(p));
  if (removed.length) await supabase.storage.from(IMAGE_BUCKET).remove(removed);

  const attachError = await syncAttachments(supabase, { announcement_id: id }, formData);
  if (publish.mode === "ahora") notifyAnnouncement(supabase, id, parsed.row);

  revalidatePath("/comunicados");
  revalidatePath("/");
  if (attachError) return { error: `El texto se guardó, pero ${attachError.toLowerCase()}` };
  return { ok: "Comunicado actualizado." };
}

export async function deleteAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración elimina comunicados." };

  const id = text(formData, "id");
  if (!id) return { error: "Comunicado inválido." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("announcements").select("content").eq("id", id).maybeSingle();
  await purgeAttachments(supabase, "announcement_id", id);
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el comunicado." };

  const paths = imagePathsOf(before?.content);
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);

  revalidatePath("/comunicados");
  revalidatePath("/");
  return { ok: "Comunicado eliminado." };
}

export async function markAsRead(formData: FormData) {
  const profile = await getProfile();
  const id = text(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  // Ignora el duplicado si ya estaba leído (llave primaria compuesta).
  await supabase
    .from("announcement_reads")
    .upsert(
      { announcement_id: id, user_id: profile.id },
      { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
    );

  revalidatePath("/comunicados");
  revalidatePath("/");
}
