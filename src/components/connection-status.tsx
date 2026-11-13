"use client";

import { useOnline } from "@/components/use-online";

/** Franja superior cuando no hay conexión: avisa que lo que se ve es lo último guardado y que no se puede guardar nada. */
export function ConnectionStatus() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-accent px-4 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] text-center text-xs font-semibold text-accent-ink"
    >
      Sin conexión: estás viendo lo último que se guardó. No se puede registrar nada hasta volver a conectarte.
    </div>
  );
}
