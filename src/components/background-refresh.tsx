"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

// Cuándo se trajo por última vez cada sección (vive mientras la pestaña esté abierta).
const lastFetched = new Map<string, number>();

/** Una sección vista hace menos de esto se considera fresca y no se vuelve a pedir. */
const FRESH_MS = 5_000;
/** Al volver a la app después de este tiempo, se actualiza la sección visible. */
const AWAY_MS = 60_000;

/**
 * Mantiene la app fluida sin mostrar datos viejos (estrategia «stale-while-revalidate»):
 *
 * - Al cambiar a una sección ya visitada, Next la muestra al instante desde su caché; aquí se pide la
 *   versión nueva en segundo plano y se intercambia sin esqueleto ni parpadeo (`router.refresh`
 *   dentro de una transición conserva lo que ya está en pantalla hasta que llega lo nuevo).
 * - Al volver a la app tras un rato (cambiar de pestaña, abrir el celular), se actualiza la sección actual.
 * - La primera visita no se refresca: el servidor ya la entregó actualizada.
 */
export function BackgroundRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const seenAt = lastFetched.get(pathname);
    const now = Date.now();
    if (seenAt === undefined) {
      lastFetched.set(pathname, now);
      return;
    }
    if (now - seenAt < FRESH_MS) return;

    const timer = setTimeout(() => {
      lastFetched.set(pathname, Date.now());
      startTransition(() => router.refresh());
    }, 300);
    return () => clearTimeout(timer);
  }, [pathname, router]);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) {
        hiddenAt = 0;
        startTransition(() => router.refresh());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  return null;
}
