import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { templateText, toWhatsAppNumber } from "@/lib/phone";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Avisos por WhatsApp con la API de WhatsApp Business (Cloud API de Meta).
 *
 * Variables de entorno (si falta alguna, el envío se omite sin error):
 * - WHATSAPP_TOKEN: token de acceso permanente del usuario del sistema.
 * - WHATSAPP_PHONE_ID: id del número de WhatsApp Business.
 * - WHATSAPP_TEMPLATE: nombre de la plantilla aprobada (por defecto «nexum_aviso»), con dos variables:
 *   {{1}} = título y {{2}} = mensaje, p. ej. «Nexum: *{{1}}*. {{2}}».
 * - WHATSAPP_LANG: código de idioma de la plantilla (por defecto «es»).
 *
 * Solo se escribe a quien dio su consentimiento (`profiles.whatsapp_opt_in`). Los mensajes iniciados
 * por la empresa exigen plantilla aprobada por Meta.
 */
export const whatsappConfigured = () => !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;

type Payload = { title: string; body: string };

async function sendOne(to: string, payload: Payload): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE || "nexum_aviso",
          language: { code: process.env.WHATSAPP_LANG || "es" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: templateText(payload.title, 120) },
                { type: "text", text: templateText(payload.body, 600) },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[whatsapp] envío fallido", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (error) {
    console.error("[whatsapp] error", error);
    return false;
  }
}

/** Envía el aviso a quienes, de `userIds`, activaron WhatsApp. Nunca lanza. Devuelve cuántos se enviaron. */
export async function sendWhatsApp(
  supabase: SupabaseClient<Database>,
  userIds: string[],
  payload: Payload,
): Promise<number> {
  try {
    if (userIds.length === 0 || !whatsappConfigured()) return 0;

    const { data } = await supabase
      .from("profiles")
      .select("phone")
      .eq("whatsapp_opt_in", true)
      .in("id", [...new Set(userIds)]);
    const numbers = [...new Set((data ?? []).map((p) => toWhatsAppNumber(p.phone)).filter((n): n is string => !!n))];

    let sent = 0;
    // De a 10 en paralelo para no saturar la API.
    for (let i = 0; i < numbers.length; i += 10) {
      const results = await Promise.all(numbers.slice(i, i + 10).map((n) => sendOne(n, payload)));
      sent += results.filter(Boolean).length;
    }
    return sent;
  } catch (error) {
    console.error("[whatsapp] error", error);
    return 0;
  }
}
