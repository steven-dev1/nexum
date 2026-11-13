import { timingSafeEqual } from "node:crypto";
import { sendNotification, setVapidDetails } from "web-push";
import { fmtDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushTo, type Admin, type Payload } from "@/lib/push-admin";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * Envía los recordatorios de asamblea que ya vencieron (`assembly_reminders.remind_at <= ahora`).
 * Se llama desde una tarea programada con `Authorization: Bearer <CRON_SECRET>`
 * (cada 5–15 minutos). No usa sesión de usuario: lee con la clave secreta del servidor.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const authorized =
    !!secret && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!authorized) return new Response("No autorizado", { status: 401 });

  const admin = createAdminClient();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!admin || !publicKey || !privateKey) {
    return Response.json({ error: "Faltan SUPABASE_SECRET_KEY o las claves VAPID" }, { status: 503 });
  }
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  setVapidDetails(
    process.env.VAPID_SUBJECT || (site ? `https://${site}` : "mailto:admin@localhost.test"),
    publicKey,
    privateKey,
  );

  // Se reclaman primero (sent_at = ahora): si dos ejecuciones se cruzan, cada recordatorio sale una sola vez.
  const { data: claimed, error } = await admin
    .from("assembly_reminders")
    .update({ sent_at: new Date().toISOString() })
    .is("sent_at", null)
    .lte("remind_at", new Date().toISOString())
    .select("id, message, assemblies!inner(id, title, scheduled_at, status)")
    .eq("assemblies.status", "programada");
  if (error) return Response.json({ error: "No se pudieron leer los recordatorios" }, { status: 500 });
  const { data: residents } = await admin.from("profiles").select("id").eq("role", "residente");
  const ids = claimed && claimed.length > 0 ? (residents ?? []).map((r) => r.id as string) : [];
  const { data: subs } = ids.length
    ? await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids)
    : { data: [] };

  let sent = 0;
  const gone: string[] = [];
  for (const reminder of claimed ?? []) {
    const assembly = reminder.assemblies as unknown as { id: string; title: string; scheduled_at: string };
    const body = JSON.stringify({
      title: "Recordatorio de asamblea",
      body: `${assembly.title} · ${fmtDateTime(assembly.scheduled_at)}`,
      url: "/asambleas",
      tag: `recordatorio-${reminder.id}`,
    });
    await sendWhatsApp(admin, ids, { title: "Recordatorio de asamblea", body: `${assembly.title} · ${fmtDateTime(assembly.scheduled_at)}` });
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            TTL: 60 * 60 * 6,
          });
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
        }
      }),
    );
  }
  if (gone.length > 0)
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", [...new Set(gone)]);

  const send = async (userIds: string[], payload: Payload) => {
    const [pushed] = await Promise.all([
      pushTo(admin, userIds, payload),
      sendWhatsApp(admin, userIds, { title: payload.title, body: payload.body }),
    ]);
    return pushed;
  };
  const polls = await notifyPolls(admin, send);
  const announcements = await notifyAnnouncements(admin, send);
  // Privacidad (Ley 1581): el documento de los visitantes se conserva solo 90 días.
  const cutoff = new Date(new Date().getTime() - 90 * 24 * 3600_000).toISOString();
  await admin.from("visit_private").delete().lt("created_at", cutoff);
  return Response.json({ reminders: claimed?.length ?? 0, sent, polls, announcements });
}

/**
 * Votaciones: (1) una hora antes del cierre avisa a las unidades que aún no han votado;
 * (2) al llegar la hora de cierre la cierra y avisa a todos que ya están los resultados.
 * Cada aviso se «reclama» antes de enviarse, así que no sale dos veces aunque se crucen ejecuciones.
 */
async function notifyPolls(admin: Admin, send: (ids: string[], payload: Payload) => Promise<number>) {
  const now = new Date();
  const in1h = new Date(now.getTime() + 3600_000).toISOString();
  let reminded = 0;
  let closed = 0;

  const { data: soon } = await admin
    .from("polls")
    .update({ reminder_sent_at: now.toISOString() })
    .eq("status", "abierta")
    .is("reminder_sent_at", null)
    .gt("closes_at", now.toISOString())
    .lte("closes_at", in1h)
    .select("id, question, closes_at");

  for (const poll of soon ?? []) {
    const [{ data: voted }, { data: residents }] = await Promise.all([
      admin.from("poll_votes").select("unit_id").eq("poll_id", poll.id),
      admin.from("profiles").select("id, unit_id").eq("role", "residente").not("unit_id", "is", null),
    ]);
    const votedUnits = new Set((voted ?? []).map((v) => v.unit_id));
    const pending = (residents ?? []).filter((r) => !votedUnits.has(r.unit_id as string)).map((r) => r.id as string);
    reminded += await send(pending, {
      title: "Tu unidad aún no ha votado",
      body: `${poll.question} · cierra ${fmtDateTime(poll.closes_at as string)}`,
      url: "/asambleas",
      tag: `votacion-${poll.id}`,
    });
  }

  const { data: ended } = await admin
    .from("polls")
    .update({ status: "cerrada", closed_at: now.toISOString(), results_sent_at: now.toISOString() })
    .eq("status", "abierta")
    .not("closes_at", "is", null)
    .lte("closes_at", now.toISOString())
    .select("id, question");

  for (const poll of ended ?? []) {
    const { data: residents } = await admin.from("profiles").select("id").eq("role", "residente");
    closed += await send((residents ?? []).map((r) => r.id as string), {
      title: "Resultados de la votación",
      body: poll.question,
      url: "/asambleas",
      tag: `votacion-${poll.id}`,
    });
  }
  return { reminded, closed };
}

/**
 * Comunicados programados: cuando llega su hora de publicación, avisa a los destinatarios.
 * Se «reclaman» (notified_at) antes de enviar para que cada uno salga una sola vez.
 */
async function notifyAnnouncements(admin: Admin, send: (ids: string[], payload: Payload) => Promise<number>) {
  const { data: due } = await admin
    .from("announcements")
    .update({ notified_at: new Date().toISOString() })
    .eq("draft", false)
    .is("notified_at", null)
    .lte("published_at", new Date().toISOString())
    .select("id, title, body, audience, tower");

  let notified = 0;
  for (const a of due ?? []) {
    const query = admin.from("profiles").select(a.tower ? "id, units!inner(tower)" : "id").eq("role", "residente");
    const { data: residents } = a.tower ? await query.eq("units.tower", a.tower) : await query;
    const ids = ((residents ?? []) as unknown as { id: string }[]).map((r) => r.id);
    notified += await send(ids, {
      title: a.audience === "torre" ? "Aviso para tu torre" : "Nuevo comunicado",
      body: `${a.title} — ${a.body.split(/[ \t\r\n]+/).join(" ").slice(0, 100)}`,
      url: "/comunicados",
      tag: `comunicado-${a.id}`,
    });
  }
  return { due: due?.length ?? 0, notified };
}
