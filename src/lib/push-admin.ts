import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/whatsapp";

export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type Payload = { title: string; body: string; url: string; tag: string };

let configured = false;
function configure() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  setVapidDetails(process.env.VAPID_SUBJECT || (site ? `https://${site}` : "mailto:admin@localhost.test"), publicKey, privateKey);
  configured = true;
  return true;
}


/** Envía una notificación a los dispositivos de `userIds` (quita los que ya no existen). */
export async function pushTo(admin: Admin, userIds: string[], payload: Payload) {
  if (userIds.length === 0 || !configure()) return 0;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", [...new Set(userIds)]);
  const body = JSON.stringify({ ...payload });
  const gone: string[] = [];
  let sent = 0;
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
  if (gone.length > 0) await admin.from("push_subscriptions").delete().in("id", gone);
  return sent;
}


/** Avisa por push y, a quien lo activó, por WhatsApp. Nunca lanza. Devuelve cuántos push salieron. */
export async function notifyUsers(admin: Admin, userIds: string[], payload: Payload) {
  try {
    const [pushed] = await Promise.all([
      pushTo(admin, userIds, payload),
      sendWhatsApp(admin, userIds, { title: payload.title, body: payload.body }),
    ]);
    return pushed;
  } catch (error) {
    console.error("[push-admin] error", error);
    return 0;
  }
}

/** Ids del personal (portería y administración). */
export async function staffIds(admin: Admin): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").in("role", ["porteria", "admin"]);
  return (data ?? []).map((p) => p.id as string);
}

/** Ids de los residentes de una unidad. */
export async function residentIdsOfUnit(admin: Admin, unitId: string): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "residente").eq("unit_id", unitId);
  return (data ?? []).map((p) => p.id as string);
}
