"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function publishAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isAdmin(profile)) return { error: "Solo la administración publica comunicados." };

  const title = text(formData, "title");
  const body = text(formData, "body");
  // `target` es "todos" o "torre:<torre>" (un solo desplegable en el formulario).
  const target = text(formData, "target");
  const audience = target.startsWith("torre:") ? "torre" : "todos";
  const tower = audience === "torre" ? target.slice("torre:".length) : "";
  if (!title || !body) return { error: "Escribe un título y el mensaje." };
  if (audience === "torre" && !tower) return { error: "Selecciona la torre destinataria." };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    audience,
    tower: audience === "torre" ? tower : null,
    pinned: formData.get("pinned") === "on",
  });
  if (error) return { error: "No se pudo publicar el comunicado." };

  revalidatePath("/comunicados");
  revalidatePath("/");
  return { ok: "Comunicado publicado." };
}

export async function markAsRead(formData: FormData) {
  const profile = await getProfile();
  const id = text(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  // Ignora el duplicado si ya estaba leído (llave primaria compuesta).
  await supabase
    .from("announcement_reads")
    .upsert({ announcement_id: id, user_id: profile.id }, { onConflict: "announcement_id,user_id", ignoreDuplicates: true });

  revalidatePath("/comunicados");
  revalidatePath("/");
}
