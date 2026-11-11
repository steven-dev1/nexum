"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { pushInBackground, residentsOfAudience, sendPush } from "@/lib/push";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** Lee y valida los campos comunes de publicar/editar. */
function readAnnouncement(formData: FormData) {
  const title = text(formData, "title");
  const body = text(formData, "body");
  // `target` es "todos" o "torre:<torre>" (un solo desplegable en el formulario).
  const target = text(formData, "target");
  const audience = target.startsWith("torre:") ? "torre" : "todos";
  const tower = audience === "torre" ? target.slice("torre:".length) : "";
  if (!title || !body) return { error: "Escribe un título y el mensaje." } as const;
  if (audience === "torre" && !tower) return { error: "Selecciona la torre destinataria." } as const;

  return {
    row: {
      title,
      body,
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

  const supabase = await createClient();
  const { data: created, error } = await supabase.from("announcements").insert(parsed.row).select("id").single();
  if (error || !created) return { error: "No se pudo publicar el comunicado." };

  pushInBackground(async () =>
    sendPush(supabase, await residentsOfAudience(supabase, parsed.row.tower), {
      title: parsed.row.audience === "torre" ? `Aviso para la torre ${parsed.row.tower}` : "Nuevo comunicado",
      body: parsed.row.title,
      url: "/comunicados",
      tag: `comunicado-${created.id}`,
    }),
  );

  revalidatePath("/comunicados");
  revalidatePath("/");
  return { ok: "Comunicado publicado." };
}

export async function updateAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración edita comunicados." };

  const id = text(formData, "id");
  if (!id) return { error: "Comunicado inválido." };

  const parsed = readAnnouncement(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").update(parsed.row).eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: "No se pudo guardar el comunicado." };

  revalidatePath("/comunicados");
  revalidatePath("/");
  return { ok: "Comunicado actualizado." };
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
