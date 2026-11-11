import { timingSafeEqual } from "node:crypto";
import { sendNotification, setVapidDetails } from "web-push";
import { fmtDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

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
  if (!claimed || claimed.length === 0) return Response.json({ reminders: 0, sent: 0 });

  const { data: residents } = await admin.from("profiles").select("id").eq("role", "residente");
  const ids = (residents ?? []).map((r) => r.id as string);
  const { data: subs } = ids.length
    ? await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids)
    : { data: [] };

  let sent = 0;
  const gone: string[] = [];
  for (const reminder of claimed) {
    const assembly = reminder.assemblies as unknown as { id: string; title: string; scheduled_at: string };
    const body = JSON.stringify({
      title: "Recordatorio de asamblea",
      body: `${assembly.title} · ${fmtDateTime(assembly.scheduled_at)}`,
      url: "/asambleas",
      tag: `recordatorio-${reminder.id}`,
    });
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

  return Response.json({ reminders: claimed.length, sent });
}
