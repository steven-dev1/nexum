"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/** Tablas que se escuchan (todas están en la publicación `supabase_realtime`). */
const TABLES = [
  "packages",
  "announcements",
  "assemblies",
  "polls",
  "poll_votes",
  "reservations",
  "vehicle_access_log",
  "visits",
] as const;

/** Qué tablas le importan a cada sección: así un cambio ajeno no recarga pantallas que no lo muestran. */
const RELEVANT: Record<string, readonly string[]> = {
  "/paqueteria": ["packages"],
  "/comunicados": ["announcements"],
  "/asambleas": ["assemblies", "polls", "poll_votes"],
  "/reservas": ["reservations"],
  "/accesos": ["vehicle_access_log", "visits"],
  "/visitas": ["visits"],
};

const relevantFor = (pathname: string): readonly string[] => {
  const key = Object.keys(RELEVANT).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  // El inicio resume todo; las demás secciones (admin, directorio…) no dependen de estas tablas.
  return key ? RELEVANT[key] : pathname === "/" ? TABLES : [];
};

/**
 * Tiempo real: cuando alguien crea o cambia algo que esta persona puede ver (un paquete, un comunicado, un voto…),
 * la pantalla se actualiza sola, sin esperar a que cambie de sección. Supabase solo envía los eventos de las filas
 * que la RLS permite leer; aquí no se usa su contenido, solo se vuelve a pedir la pantalla actual.
 * `BackgroundRefresh` queda como respaldo si la conexión se cae.
 */
export function RealtimeRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel("nexum-live");

    for (const table of TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (!relevantFor(pathRef.current).includes(table)) return;
        // Varios cambios seguidos (p. ej. un voto y su participación) se agrupan en una sola actualización.
        clearTimeout(timer.current);
        timer.current = setTimeout(() => startTransition(() => router.refresh()), 400);
      });
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
