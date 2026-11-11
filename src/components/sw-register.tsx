"use client";

import { useEffect } from "react";

/** Registra el service worker (necesario para instalar la app y mostrar la página sin conexión). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin service worker la app sigue funcionando como web; solo no se podrá instalar.
    });
  }, []);

  return null;
}
