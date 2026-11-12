"use client";

import Link from "next/link";
import { useEffect } from "react";
import { btnGhost, btnPrimary } from "@/components/ui";

/** Se muestra si falla una sección: el resto de la app (menú, sesión) sigue funcionando. */
export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // `digest` identifica el error en los registros del servidor (Vercel → Logs).
    console.error("[app] error de sección", error.digest ?? "", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-line bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold text-ink">Algo salió mal</h1>
      <p className="mt-1.5 text-sm text-muted">
        No pudimos cargar esta sección. Intenta de nuevo; si sigue fallando, avisa a la administración.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted">Código: {error.digest}</p>}
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={reset} className={btnPrimary}>
          Reintentar
        </button>
        <Link href="/" className={btnGhost}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
