"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

type SubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

/** Guarda el dispositivo del usuario actual para poder enviarle notificaciones. */
export async function savePushSubscription(input: SubscriptionInput): Promise<{ ok: boolean }> {
  const profile = await getProfile();
  const { endpoint, keys } = input;
  if (!endpoint?.startsWith("https://") || !keys?.p256dh || !keys?.auth) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: profile.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "user_id,endpoint" },
  );
  return { ok: !error };
}

/** Quita el dispositivo del usuario actual (al desactivar los avisos). */
export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const profile = await getProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", profile.id)
    .eq("endpoint", endpoint);
  return { ok: !error };
}
