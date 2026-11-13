"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { createTicket } from "@/app/(app)/ayuda/actions";
import { ActionForm } from "@/components/action-form";
import { Modal, useModal } from "@/components/modal";
import { PhotoCapture } from "@/components/photo-capture";
import { Select } from "@/components/select";
import { btnGhost, btnPrimary, Field, inputCls } from "@/components/ui";
import { BODY_MAX, KINDS, SUBJECT_MAX, TARGETS } from "@/lib/support";

const noopSubscribe = () => () => {};

/** Datos del dispositivo que acompañan la solicitud (se leen en el navegador; en el servidor quedan vacíos). */
function useDeviceInfo() {
  const ua = useSyncExternalStore(noopSubscribe, () => navigator.userAgent, () => "");
  const viewport = useSyncExternalStore(noopSubscribe, () => `${window.innerWidth}x${window.innerHeight}`, () => "");
  return { ua, viewport };
}

function SeeRequests() {
  const modal = useModal();
  return (
    <Link href="/ayuda" onClick={() => modal?.close()} className="text-sm font-semibold text-primary-ink underline-offset-2 hover:underline">
      Ver mis solicitudes
    </Link>
  );
}

function HelpFields({ whatsapp }: { whatsapp?: string }) {
  const pathname = usePathname();
  const { ua, viewport } = useDeviceInfo();
  const waNumber = (whatsapp ?? "").replace(/\D/g, "");

  return (
    <>
      <input type="hidden" name="context_page" value={pathname} />
      <input type="hidden" name="context_ua" value={ua} />
      <input type="hidden" name="context_viewport" value={viewport} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="¿Qué necesitas?" name="kind" required defaultValue="ayuda" options={KINDS.map((k) => ({ value: k.value, label: k.label, hint: k.hint }))} />
        <Select label="Dirigida a" name="target" required defaultValue="administracion" options={TARGETS.map((t) => ({ value: t.value, label: t.label, hint: t.hint }))} />
      </div>
      <Field label="Asunto">
        <input name="subject" required minLength={3} maxLength={SUBJECT_MAX} placeholder="No me deja reservar el salón social" className={inputCls} autoFocus />
      </Field>
      <Field label="Cuéntanos qué pasó o qué necesitas" hint="Mientras más detalle, más rápido te ayudamos. Adjuntamos solo la sección y el tipo de dispositivo; nunca tu contraseña.">
        <textarea name="body" required minLength={5} maxLength={BODY_MAX} rows={5} className={inputCls} />
      </Field>
      <PhotoCapture name="photo" label="Captura o foto (opcional)" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
        <SeeRequests />
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Hola, necesito ayuda con Nexum.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-ink underline-offset-2 hover:underline"
          >
            Escribir por WhatsApp
          </a>
        )}
      </div>
    </>
  );
}

/**
 * Botón «Ayuda»: abre un formulario para pedir ayuda, reportar un problema o enviar una sugerencia a la
 * administración o a soporte técnico. Las respuestas llegan por notificación y se leen en «Mis solicitudes».
 */
export function HelpButton({
  variant = "ghost",
  label = "Ayuda",
  whatsapp,
  className = "",
}: {
  variant?: "ghost" | "primary";
  label?: string;
  /** Número de WhatsApp de soporte (opcional): agrega un enlace directo en el formulario. */
  whatsapp?: string;
  className?: string;
}) {
  return (
    <Modal
      title="Centro de ayuda"
      description="Cuéntanos qué necesitas y te respondemos por aquí."
      icon="megaphone"
      trigger={
        <>
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17.5h.01" />
          </svg>
          {label}
        </>
      }
      triggerLabel={label}
      triggerClassName={`${variant === "primary" ? btnPrimary : btnGhost} ${className}`}
      size="lg"
    >
      <ActionForm action={createTicket} submitLabel="Enviar" pendingLabel="Enviando…" variant="accent">
        <HelpFields whatsapp={whatsapp} />
      </ActionForm>
    </Modal>
  );
}
