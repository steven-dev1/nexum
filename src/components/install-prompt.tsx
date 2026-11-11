"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { btnAccent, btnGhost, btnSm } from "@/components/ui";

type Platform = "server" | "installed" | "ios" | "android" | "other";

// El navegador dispara `beforeinstallprompt` (Chrome/Edge/Android) cuando la app se puede instalar.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "nexum-install-dismissed";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", listener);
  };
}

function platform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  // iPadOS se identifica como Mac con pantalla táctil.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Invita a instalar Nexum en la pantalla de inicio. No aparece si ya está instalada,
 * si se descartó antes o en computadores sin soporte de instalación.
 */
export function InstallPrompt() {
  const current = useSyncExternalStore(subscribe, platform, (): Platform => "server");
  const hidden = useSyncExternalStore(subscribe, dismissed, () => true);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || current === "server" || current === "installed") return null;
  // En computador solo se ofrece si el navegador lo permite (evento disponible).
  if (current === "other" && !event) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    notify();
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === "accepted") dismiss();
  }

  return (
    <section
      aria-label="Instalar Nexum"
      className="mb-5 flex gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-sm"
    >
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-on-primary">
        N
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">Instala Nexum en tu celular</p>
        {event ? (
          <p className="mt-0.5 text-sm text-muted">
            Ábrela como una app, a pantalla completa y con avisos de tus paquetes.
          </p>
        ) : current === "ios" ? (
          <ol className="mt-1 space-y-1 text-sm text-muted">
            <li>
              1. Toca <b className="text-ink">Compartir</b>{" "}
              <svg
                className="inline size-4 align-text-bottom text-primary-ink"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>{" "}
              en Safari.
            </li>
            <li>
              2. Elige <b className="text-ink">Añadir a pantalla de inicio</b>.
            </li>
          </ol>
        ) : (
          <p className="mt-0.5 text-sm text-muted">
            Abre el menú del navegador <b className="text-ink">⋮</b> y elige{" "}
            <b className="text-ink">Instalar aplicación</b> (o «Añadir a pantalla de inicio»).
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {event && (
            <button type="button" onClick={install} className={`${btnAccent} ${btnSm}`}>
              Instalar
            </button>
          )}
          <button type="button" onClick={dismiss} className={`${btnGhost} ${btnSm}`}>
            Ahora no
          </button>
        </div>
      </div>
    </section>
  );
}
