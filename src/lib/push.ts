import "server-only";
import { after } from "next/server";
import { sendNotification, setVapidDetails } from "web-push";
import type { createClient } from "@/lib/supabase/server";
import { sendWhatsApp } from "@/lib/whatsapp";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PushPayload = {
  title: string;
  body: string;
  /** Ruta que se abre al tocar la notificación. */
  url: string;
  /** Misma etiqueta = reemplaza la notificación anterior. */
  tag?: string;
};

let configured = false;

/** Configura web-push una sola vez. Devuelve false si faltan las claves VAPID (el envío se omite). */
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  // El servicio de push (Apple, Google…) exige un contacto del remitente.
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.VAPID_SUBJECT || (site ? `https://${site}` : "mailto:admin@localhost.test");
  setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Envía la notificación a todos los dispositivos de `userIds`. Nunca lanza: un fallo de
 * notificación no debe hacer fallar la acción que lo originó. Quita los dispositivos
 * que el servicio de push reporta como inexistentes (404/410).
 */
async function sendWebPush(supabase: Supabase, userIds: string[], payload: PushPayload): Promise<number> {
  try {
    if (userIds.length === 0 || !configure()) return 0;

    const { data } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", [...new Set(userIds)]);
    const subs = (data ?? []) as Subscription[];
    if (subs.length === 0) return 0;

    const body = JSON.stringify(payload);
    const gone: string[] = [];
    let sent = 0;

    await Promise.all(
      subs.map(async (s) => {
        try {
          await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            TTL: 60 * 60 * 24, // si el celular está apagado, se entrega durante las próximas 24 h
            urgency: "normal",
          });
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
          else console.error("[push] envío fallido", status ?? error);
        }
      }),
    );

    if (gone.length > 0) await supabase.from("push_subscriptions").delete().in("id", gone);
    return sent;
  } catch (error) {
    console.error("[push] error", error);
    return 0;
  }
}

/**
 * Avisa por todos los canales: notificación push y, para quien lo activó, WhatsApp.
 * Devuelve cuántas notificaciones push salieron. Nunca lanza.
 */
export async function sendPush(supabase: Supabase, userIds: string[], payload: PushPayload): Promise<number> {
  const [pushed] = await Promise.all([
    sendWebPush(supabase, userIds, payload),
    sendWhatsApp(supabase, userIds, { title: payload.title, body: payload.body }),
  ]);
  return pushed;
}

/** Ejecuta el envío después de responder al usuario (no lo hace esperar). */
export function pushInBackground(task: () => Promise<unknown>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error("[push] error en segundo plano", error);
    }
  });
}

/** Ids de los residentes de una unidad. */
export async function residentsOfUnit(supabase: Supabase, unitId: string): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("id").eq("role", "residente").eq("unit_id", unitId);
  return (data ?? []).map((p) => p.id as string);
}

/** Ids de los residentes de todo el conjunto o, si se indica `tower`, solo de esa torre. */
export async function residentsOfAudience(supabase: Supabase, tower?: string | null): Promise<string[]> {
  if (tower) {
    const { data } = await supabase
      .from("profiles")
      .select("id, units!inner(tower)")
      .eq("role", "residente")
      .eq("units.tower", tower);
    return (data ?? []).map((p) => p.id as string);
  }
  const { data } = await supabase.from("profiles").select("id").eq("role", "residente");
  return (data ?? []).map((p) => p.id as string);
}
