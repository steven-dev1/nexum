import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave secreta (omite la RLS). SOLO para tareas del servidor sin usuario,
 * como los recordatorios programados. Nunca lo uses en acciones de usuario ni lo importes
 * desde componentes de cliente. Devuelve null si la clave no está configurada.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
