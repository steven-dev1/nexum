"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { removePushSubscription, savePushSubscription } from "@/lib/actions/push";
import { btnAccent, btnGhost } from "@/components/ui";

type Support = "server" | "unsupported" | "install-first" | "ready";

const noopSubscribe = () => () => {};

/** Qué puede hacer este dispositivo: notificar, necesita instalar la app primero (iPhone) o no puede. */
function support(): Support {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // En iPhone las notificaciones solo existen para la app instalada en la pantalla de inicio.
  if (ios && !standalone) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return "unsupported";
  return "ready";
}

/** Clave pública VAPID (base64url) → bytes, el formato que pide pushManager.subscribe. */
function toKey(base64: string) {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Activa o desactiva las notificaciones de este dispositivo. */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | undefined }) {
  const current = useSyncExternalStore(noopSubscribe, support, (): Support => "server");
  const [on, setOn] = useState<boolean | null>(null); // null = comprobando
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ¿Este dispositivo ya está suscrito?
  useEffect(() => {
    if (current !== "ready") return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) {
          setOn(!!sub);
          setDenied(Notification.permission === "denied");
        }
      } catch {
        if (!cancelled) setOn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current]);

  if (current === "server" || !vapidPublicKey) return null;

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(permission === "denied");
        setMessage(
          permission === "denied"
            ? "Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador para este sitio."
            : "No se activaron los avisos.",
        );
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidPublicKey!) }));
      const json = sub.toJSON();
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        userAgent: navigator.userAgent,
      });
      if (!result.ok) throw new Error("No se pudo guardar");
      setOn(true);
      setMessage("Listo: te avisaremos de paquetes, comunicados y asambleas.");
    } catch {
      setMessage("No se pudieron activar los avisos. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setOn(false);
    } catch {
      setMessage("No se pudieron desactivar los avisos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-bg p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Avisos en tu celular</p>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            {current === "install-first"
              ? "En iPhone, primero añade Nexum a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí."
              : current === "unsupported"
                ? "Este navegador no permite notificaciones."
                : denied
                  ? "Bloqueadas en este navegador. Actívalas en los ajustes del sitio."
                  : on
                    ? "Activados en este dispositivo: paquetes, comunicados y asambleas."
                    : "Entérate al instante cuando llegue un paquete o haya un comunicado."}
          </p>
        </div>
      </div>

      {current === "ready" && !denied && on !== null && (
        <div className="mt-3">
          {on ? (
            <button type="button" onClick={disable} disabled={busy} className={`${btnGhost} w-full`}>
              {busy ? "Desactivando…" : "Desactivar avisos"}
            </button>
          ) : (
            <button type="button" onClick={enable} disabled={busy} className={`${btnAccent} w-full`}>
              {busy ? "Activando…" : "Activar avisos"}
            </button>
          )}
        </div>
      )}

      {message && (
        <p role="status" className="mt-2 text-xs leading-5 text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
