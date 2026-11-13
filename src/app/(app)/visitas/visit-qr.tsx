"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { btnGhost, btnPrimary, btnSm } from "@/components/ui";
import { qrPayload, shareText } from "@/lib/visits";

/** Código y QR de una autorización, con opciones para copiarla o compartirla (WhatsApp, etc.). */
export function VisitQr({
  code,
  name,
  until,
  unit,
  plate,
}: {
  code: string;
  name: string;
  /** Vigencia ya formateada en el servidor. */
  until: string;
  unit: string;
  plate: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const message = shareText({ name, code, until, unit, plate });

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrPayload(code), { margin: 1, width: 280, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sin permiso del portapapeles */
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Modal
      title="Código de acceso"
      description={name}
      icon="users"
      trigger="Código y QR"
      triggerClassName={`${btnPrimary} ${btnSm}`}
    >
      <div className="space-y-4 border-t border-line px-6 py-5 text-center">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen generada en el navegador (data:)
          <img src={src} alt={`Código QR de ${name}`} width={240} height={240} className="mx-auto rounded-xl border border-line bg-white p-2" />
        ) : (
          <div className="mx-auto size-60 animate-pulse rounded-xl bg-surface-2" aria-hidden />
        )}
        <div>
          <p className="font-mono text-3xl font-bold tracking-[0.3em] text-ink">{code}</p>
          <p className="mt-1 text-sm text-muted">Válido hasta {until}</p>
          {plate && <p className="text-sm text-muted">Placa {plate}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={copy} className={`${btnGhost} ${btnSm}`}>
            {copied ? "Copiado" : "Copiar mensaje"}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={() => navigator.share({ title: "Autorización de ingreso", text: message }).catch(() => {})}
              className={`${btnPrimary} ${btnSm}`}
            >
              Compartir
            </button>
          )}
        </div>
        <p className="text-xs leading-5 text-muted">
          Tu visitante puede mostrar el código o el QR en portería. Pierde validez al terminar el horario.
        </p>
      </div>
    </Modal>
  );
}
