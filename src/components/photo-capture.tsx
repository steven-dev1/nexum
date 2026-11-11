"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { btnGhost, btnPrimary, btnSm, labelCls } from "@/components/ui";

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Reduce la foto (máx. 1600 px por lado, JPEG) para subirla rápido y ocupar poco. */
async function compress(source: Blob | HTMLVideoElement): Promise<File> {
  let width: number;
  let height: number;
  let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

  if (source instanceof HTMLVideoElement) {
    width = source.videoWidth;
    height = source.videoHeight;
    draw = (ctx, w, h) => ctx.drawImage(source, 0, 0, w, h);
  } else {
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    width = bitmap.width;
    height = bitmap.height;
    draw = (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h);
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  draw(canvas.getContext("2d")!, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la foto"))), "image/jpeg", QUALITY),
  );
  return new File([blob], "paquete.jpg", { type: "image/jpeg" });
}

/**
 * Foto opcional para un formulario: con cámara (en celular abre la cámara
 * trasera; en computador usa la cámara web) o subiendo una imagen.
 * La foto comprimida viaja en el formulario en el input `name`.
 */
export function PhotoCapture({ name, label = "Foto" }: { name: string; label?: string }) {
  const fieldRef = useRef<HTMLInputElement>(null); // el que se envía
  const cameraInputRef = useRef<HTMLInputElement>(null); // cámara nativa (celular)
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  };

  // Libera la cámara y la vista previa al cerrar el formulario.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function applyPhoto(source: Blob | HTMLVideoElement) {
    setBusy(true);
    setError(null);
    try {
      const file = await compress(source);
      const transfer = new DataTransfer();
      transfer.items.add(file);
      if (fieldRef.current) fieldRef.current.files = transfer.files;
      setPreview(URL.createObjectURL(file));
    } catch {
      setError("No se pudo procesar la foto. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    setError(null);
    // En celulares y tabletas la cámara nativa da mejor resultado.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("No se pudo abrir la cámara. Revisa los permisos del navegador o sube una imagen.");
    }
  }

  async function capture() {
    if (!videoRef.current) return;
    await applyPhoto(videoRef.current);
    stopCamera();
  }

  function clear() {
    if (fieldRef.current) fieldRef.current.value = "";
    setPreview(null);
  }

  const icon = (d: ReactNode) => (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d}
    </svg>
  );
  const cameraIcon = icon(
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>,
  );

  return (
    <div>
      <span className={labelCls}>{label}</span>

      <input ref={fieldRef} type="file" name={name} accept="image/*" hidden />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => e.target.files?.[0] && applyPhoto(e.target.files[0])}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && applyPhoto(e.target.files[0])}
      />

      {live ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
          <div className="flex justify-end gap-2 bg-surface p-2.5">
            <button type="button" onClick={stopCamera} className={`${btnGhost} ${btnSm}`}>
              Cancelar
            </button>
            <button type="button" onClick={capture} disabled={busy} className={`${btnPrimary} ${btnSm}`}>
              {cameraIcon}
              Capturar
            </button>
          </div>
        </div>
      ) : preview ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
          <img src={preview} alt="Foto del paquete" className="size-20 rounded-xl object-cover" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
              {icon(<path d="m5 12 5 5L20 7" />)}
              Foto lista
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={takePhoto} className={`${btnGhost} ${btnSm}`}>
                Repetir
              </button>
              <button type="button" onClick={clear} className={`${btnGhost} ${btnSm}`}>
                Quitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={takePhoto}
            disabled={busy}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-dashed border-line bg-bg px-3 py-4 text-sm font-semibold text-ink transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink disabled:opacity-60"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
              {cameraIcon}
            </span>
            {busy ? "Procesando…" : "Tomar foto"}
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={busy}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-dashed border-line bg-bg px-3 py-4 text-sm font-semibold text-ink transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink disabled:opacity-60"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink">
              {icon(
                <>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m17 8-5-5-5 5M12 3v12" />
                </>,
              )}
            </span>
            Subir imagen
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
