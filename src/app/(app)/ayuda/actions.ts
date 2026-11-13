"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ActionState } from "@/lib/action-state";
import { getProfile, isAdmin } from "@/lib/auth";
import { pushInBackground, sendPush } from "@/lib/push";
import { notifyUsers } from "@/lib/push-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanContext, isKind, isStatus, isTarget, validateTicket, webhookPayload } from "@/lib/support";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

const PHOTO_BUCKET = "support-files";
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

function refresh() {
  revalidatePath("/ayuda");
  revalidatePath("/admin/soporte");
  revalidatePath("/admin");
}

/** Avisa a los administradores (push y WhatsApp si lo activaron). Si falta la clave de servicio, se omite. */
async function notifyAdmins(title: string, body: string, tag: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin.from("profiles").select("id").eq("role", "admin");
  await notifyUsers(admin, (data ?? []).map((p) => p.id as string), { title, body, url: "/admin/soporte", tag });
}

/** Crea una solicitud (con su primer mensaje y una captura opcional) y avisa a quien la atiende. */
export async function createTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();

  const kind = text(formData, "kind");
  const target = text(formData, "target");
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  if (!isKind(kind)) return { error: "Elige qué necesitas." };
  if (!isTarget(target)) return { error: "Elige a quién va dirigida." };
  const invalid = validateTicket(subject, body);
  if (invalid) return { error: invalid };

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && !PHOTO_TYPES[photo.type]) return { error: "La captura debe ser JPG, PNG o WEBP." };
  if (hasPhoto && photo.size > PHOTO_MAX_BYTES) return { error: "La captura es demasiado grande (máx. 4 MB)." };

  const context = cleanContext(
    { page: text(formData, "context_page"), ua: text(formData, "context_ua"), viewport: text(formData, "context_viewport") },
    { role: profile.role, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "" },
  );

  const supabase = await createClient();

  let photoPath: string | null = null;
  if (hasPhoto) {
    const path = `${profile.id}/${crypto.randomUUID()}.${PHOTO_TYPES[photo.type]}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: photo.type });
    if (!error) photoPath = path;
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({ kind, target, subject, context, photo_path: photoPath })
    .select("id")
    .single();
  if (error || !ticket) {
    if (photoPath) await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    return { error: "No se pudo enviar la solicitud. Intenta de nuevo." };
  }
  const { error: messageError } = await supabase.from("support_messages").insert({ ticket_id: ticket.id, body });
  if (messageError) return { error: "La solicitud se creó, pero no se pudo guardar el mensaje. Escríbelo de nuevo en «Mis solicitudes»." };

  const who = `${profile.fullName || profile.email || "Usuario"}${profile.unitLabel ? ` · ${profile.unitLabel}` : ""}`;
  after(async () => {
    try {
      await notifyAdmins(target === "soporte_tecnico" ? "Solicitud de soporte técnico" : "Nueva solicitud de ayuda", `${who}: ${subject}`, `ayuda-${ticket.id}`);
      // Soporte técnico también puede reenviarse a un canal externo (Slack, Discord, correo por webhook…).
      const hook = process.env.SUPPORT_WEBHOOK_URL;
      if (target === "soporte_tecnico" && hook) {
        const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;
        await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload({ id: ticket.id, kind, subject, body, who, context, site })),
          signal: AbortSignal.timeout(8000),
        });
      }
    } catch (e) {
      console.error("[ayuda] aviso fallido", e);
    }
  });

  refresh();
  return { ok: "Solicitud enviada. Te avisaremos cuando respondan; puedes verla en «Mis solicitudes»." };
}

/** Agrega un mensaje a una solicitud (la persona o la administración) y avisa a la otra parte. */
export async function replyTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  const ticketId = text(formData, "ticket_id");
  const body = text(formData, "body");
  if (!ticketId) return { error: "Solicitud inválida." };
  if (body.length < 1) return { error: "Escribe tu mensaje." };
  if (body.length > 4000) return { error: "El mensaje admite hasta 4000 caracteres." };

  const supabase = await createClient();
  const { data: ticket } = await supabase.from("support_tickets").select("id, user_id, subject").eq("id", ticketId).maybeSingle();
  if (!ticket) return { error: "No se encontró la solicitud." };

  // `from_staff` lo exige la RLS: solo es verdadero si quien escribe es administrador.
  const staff = isAdmin(profile);
  const { error } = await supabase.from("support_messages").insert({ ticket_id: ticketId, body, from_staff: staff });
  if (error) return { error: "No se pudo enviar el mensaje." };

  if (staff && ticket.user_id !== profile.id) {
    pushInBackground(() =>
      sendPush(supabase, [ticket.user_id], { title: "Respondieron tu solicitud", body: ticket.subject, url: "/ayuda", tag: `ayuda-${ticketId}` }),
    );
  } else if (!staff) {
    after(() => notifyAdmins("Nuevo mensaje en una solicitud", `${profile.fullName || "Un usuario"}: ${ticket.subject}`, `ayuda-${ticketId}`));
  }

  refresh();
  return { ok: "Mensaje enviado." };
}

/** Administración: cambia el estado de una solicitud. */
export async function setTicketStatus(formData: FormData) {
  const profile = await getProfile();
  if (!isAdmin(profile)) return;
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !isStatus(status)) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("user_id, subject");
  const ticket = data?.[0];
  if (ticket && status === "resuelta" && ticket.user_id !== profile.id) {
    pushInBackground(() =>
      sendPush(supabase, [ticket.user_id], { title: "Tu solicitud se resolvió", body: ticket.subject, url: "/ayuda", tag: `ayuda-${id}` }),
    );
  }
  refresh();
}

