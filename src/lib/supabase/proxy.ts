import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Rutas accesibles sin sesión: el inicio de sesión y los recursos que el navegador pide
// para instalar la PWA (manifest, íconos, service worker y página sin conexión).
const PUBLIC_PATHS = [
  "/login",
  "/manifest.webmanifest",
  "/pwa-icon",
  "/apple-icon",
  "/icon",
  "/sw.js",
  "/offline",
  // Llamada por la tarea programada (sin sesión); la protege el CRON_SECRET.
  "/api/push/reminders",
];

/**
 * Refresca la sesión de Supabase en cada request y redirige a /login
 * si no hay sesión válida. Debe devolver la respuesta que construye `setAll`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          cacheHeaders = headers ?? {};
          Object.entries(cacheHeaders).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims valida el JWT; no usar getSession() en el servidor.
  const { data } = await supabase.auth.getClaims();
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  // Las Server Actions (POST con cabecera `next-action`) esperan una respuesta de
  // acción, no HTML: redirigirlas desde aquí rompe el cliente ("unexpected response").
  // Cada acción valida la sesión por su cuenta (getProfile → redirect desde la acción).
  const isServerAction = request.headers.has("next-action");

  if (!data?.claims && !isPublic && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    Object.entries(cacheHeaders).forEach(([key, value]) =>
      redirect.headers.set(key, value),
    );
    return redirect;
  }

  return supabaseResponse;
}
