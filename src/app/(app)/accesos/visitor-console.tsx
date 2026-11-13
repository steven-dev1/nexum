"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { btnGhost, btnPrimary, btnSm, inputCls } from "@/components/ui";
import { parseVisitCode } from "@/lib/visits";
import { checkInVisit, type VisitCheck } from "./visit-actions";

const tone = {
  success: "border-success bg-success-soft",
  warning: "border-accent bg-accent-soft",
  danger: "border-danger bg-danger-soft",
} as const;

/** Validar a una visita por código escrito o QR (cámara). */
export function VisitorConsole() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VisitCheck | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);

  function validate(raw: string) {
    startTransition(async () => {
      setResult(await checkInVisit(raw));
      setCode("");
    });
  }

  function stopScan() {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setScanning(false);
  }

  // La cámara se enciende al abrir el visor y se libera al cerrarlo o al salir de la pantalla.
  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;
        const scanner = new QrScanner(
          videoRef.current,
          (found) => {
            const parsed = parseVisitCode(found.data);
            if (!parsed) return; // otro QR: se sigue buscando
            scannerRef.current?.stop();
            scannerRef.current?.destroy();
            scannerRef.current = null;
            setScanning(false);
            validate(parsed);
          },
          { preferredCamera: "environment", highlightScanRegion: true, maxScansPerSecond: 8, returnDetailedScanResult: true },
        );
        scannerRef.current = scanner;
        await scanner.start();
      } catch {
        if (!cancelled) {
          setScanError("No se pudo abrir la cámara. Revisa los permisos o escribe el código.");
          setScanning(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [scanning]);

  const parsed = parseVisitCode(code);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4 md:p-5">
        <h2 className="text-base font-semibold text-ink">Validar visita</h2>
        <p className="mt-0.5 text-sm text-muted">Escribe el código de 6 caracteres o escanea el QR de la visita.</p>

        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed) validate(parsed);
          }}
        >
          <label className="sr-only" htmlFor="visit-code">
            Código de la visita
          </label>
          <input
            id="visit-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Código: ABC234"
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            className={`${inputCls} max-w-48 font-mono uppercase tracking-widest`}
          />
          <button type="submit" disabled={pending || !parsed} className={btnPrimary}>
            {pending ? "Validando…" : "Registrar ingreso"}
          </button>
          <button
            type="button"
            onClick={() => {
              setScanError(null);
              if (scanning) stopScan();
              else setScanning(true);
            }}
            className={btnGhost}
          >
            {scanning ? "Cerrar cámara" : "Escanear QR"}
          </button>
        </form>

        {scanning && (
          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-black">
            <video ref={videoRef} playsInline muted className="aspect-video max-h-72 w-full object-cover" />
          </div>
        )}
        {scanError && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {scanError}
          </p>
        )}
      </div>

      {result && (
        <div role="status" className={`rounded-xl border-2 p-4 md:p-5 ${tone[result.tone]}`}>
          <p className="text-xl font-bold text-ink">
            {result.result === "ok" ? "Ingreso autorizado" : result.tone === "warning" ? "Atención" : "No autorizado"}
          </p>
          {result.visit && (
            <p className="mt-1 text-base font-semibold text-ink">
              {result.visit.name}
              {result.visit.unit && <span className="font-normal text-muted"> · {result.visit.unit}</span>}
              {result.visit.plate && <span className="ml-2 font-mono tracking-widest">{result.visit.plate}</span>}
            </p>
          )}
          <p className="mt-1 text-sm text-ink">{result.message}</p>
          <button type="button" className={`${btnGhost} ${btnSm} mt-3`} onClick={() => setResult(null)}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
