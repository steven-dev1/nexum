import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sin conexión" };

/** Se muestra desde el service worker cuando no hay internet al abrir la app. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Brand />
      <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-ink">
        <svg
          className="size-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01" />
          <path d="m3 3 18 18" />
        </svg>
      </span>
      <div className="max-w-xs">
        <h1 className="text-xl font-bold text-ink">Sin conexión</h1>
        <p className="mt-1.5 text-sm text-muted">
          No pudimos conectar con Nexum. Revisa tu internet e inténtalo de nuevo.
        </p>
      </div>
      <RetryButton />
    </main>
  );
}
