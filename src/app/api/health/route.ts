/**
 * Estado del servicio para monitores externos (UptimeRobot, Better Stack…).
 * Público y sin datos sensibles: responde 200 si la app y Supabase Auth están arriba, 503 si no.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let database = false;
  if (url && key) {
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      database = res.ok;
    } catch {
      database = false;
    }
  }
  return Response.json({ ok: database, database }, { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
