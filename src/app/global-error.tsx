"use client";

import { useEffect } from "react";

/** Último recurso: falló incluso el diseño raíz. Usa estilos propios porque la app puede no haber cargado. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] error global", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="es-CO">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 16px" }}>No pudimos cargar Nexum. Intenta de nuevo.</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#1d4ed8", color: "#fff", border: 0, borderRadius: 12, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
