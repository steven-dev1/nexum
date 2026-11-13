"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSpeechRecognition } from "@/components/use-speech-recognition";
import { btnGhost, btnPrimary, btnSm, inputCls } from "@/components/ui";
import { normalizePlate, parseSpokenCommand, spellPlate, type Direction } from "@/lib/plate";
import { submitPlate, undoAccess, type AccessResult } from "./actions";

const kindLabel: Record<string, string> = { carro: "Carro", moto: "Moto", otro: "Vehículo" };

/** Texto que se lee en voz alta (sin «·» ni símbolos que el sintetizador pronuncia raro). */
function spokenText(r: AccessResult) {
  const plate = spellPlate(r.plate);
  switch (r.status) {
    case "autorizado":
      return `${r.direction === "ingreso" ? "Ingreso autorizado" : "Salida registrada"}. ${r.unit?.replace("·", ",") ?? ""}.`;
    case "no_registrada":
      return `Placa ${plate}. No está registrada.`;
    case "inactivo":
      return `Placa ${plate}. Vehículo inactivo.`;
    case "confirmar":
      return `${r.message ?? ""} Confirma para registrar.`;
    default:
      return r.message ?? "No se pudo registrar.";
  }
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-CO";
    window.speechSynthesis.speak(u);
  } catch {
    /* sin voz de respuesta: la pantalla ya lo muestra */
  }
}

const tone = {
  autorizado: "border-success bg-success-soft",
  no_registrada: "border-danger bg-danger-soft",
  inactivo: "border-danger bg-danger-soft",
  confirmar: "border-accent bg-accent-soft",
  error: "border-danger bg-danger-soft",
} as const;

const heading: Record<string, string> = {
  autorizado: "Autorizado",
  no_registrada: "Placa no registrada",
  inactivo: "Vehículo inactivo",
  confirmar: "Confirma el movimiento",
  error: "No se pudo registrar",
};

/**
 * Consola de portería: se dice «ingresa placa ABC123» (o «sale placa…») y se valida y registra.
 * Siempre queda el campo de placa manual como respaldo (sin micrófono o navegador sin voz).
 */
export function VoiceConsole() {
  const [mode, setMode] = useState<Direction>("ingreso");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<(AccessResult & { heard?: string; method: "voz" | "manual"; transcript?: string }) | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [undone, setUndone] = useState(false);
  const [pending, startTransition] = useTransition();
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const run = useCallback((plate: string, direction: Direction, method: "voz" | "manual", transcript?: string, force = false) => {
    startTransition(async () => {
      const r = await submitPlate({ plate, direction, method, transcript, force });
      setUndone(false);
      setResult({ ...r, method, transcript });
      speak(spokenText(r));
    });
  }, []);

  const onSpoken = useCallback(
    (alternatives: string[]) => {
      setHeard(alternatives[0] ?? null);
      const parsed = parseSpokenCommand(alternatives);
      if (parsed.plates.length === 0) {
        setResult(null);
        speak("No entendí la placa. Repite, por favor.");
        return;
      }
      run(parsed.plates[0], parsed.direction ?? modeRef.current, "voz", alternatives[0]);
    },
    [run],
  );

  const { supported, listening, interim, error, start, stop } = useSpeechRecognition({ onResult: onSpoken });

  // Barra espaciadora = hablar (si no se está escribiendo en un campo).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.code !== "Space" || e.repeat || target?.closest("input, textarea, select, button, [contenteditable]")) return;
      e.preventDefault();
      if (listening) stop();
      else start();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, start, stop]);

  const plateInput = normalizePlate(manual);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4 md:p-5">
        <div role="group" aria-label="Movimiento por defecto" className="mb-4 inline-flex rounded-xl border border-line bg-bg p-1">
          {(["ingreso", "salida"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={mode === d}
              onClick={(e) => {
                setMode(d);
                // Sin foco en el botón, la barra espaciadora vuelve a activar el micrófono.
                e.currentTarget.blur();
              }}
              className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                mode === d ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
              }`}
            >
              {d === "ingreso" ? "Ingreso" : "Salida"}
            </button>
          ))}
        </div>

        {supported ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={listening ? stop : start}
              disabled={pending}
              aria-pressed={listening}
              className={`inline-flex size-28 cursor-pointer items-center justify-center rounded-full text-on-primary shadow-lg transition-transform active:scale-95 disabled:opacity-60 ${
                listening ? "animate-pulse bg-danger" : "bg-primary hover:bg-primary-hover"
              }`}
            >
              <span className="sr-only">{listening ? "Detener" : "Hablar"}</span>
              <svg className="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
              </svg>
            </button>
            <p className="text-sm font-semibold text-ink" aria-live="polite">
              {listening ? "Escuchando… di «ingresa placa» y la placa" : pending ? "Verificando…" : "Toca el micrófono o presiona la barra espaciadora"}
            </p>
            {(listening ? interim : heard) && (
              <p className="max-w-md rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-muted">
                {listening ? "Escuchando: " : "Se escuchó: "}«{listening ? interim : heard}»
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">
            Este navegador no tiene reconocimiento de voz. Usa Chrome, Edge o Safari, o escribe la placa abajo.
          </p>
        )}

        <form
          className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (plateInput) run(plateInput, mode, "manual");
          }}
        >
          <label className="sr-only" htmlFor="plate-manual">
            Placa
          </label>
          <input
            id="plate-manual"
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="Placa: ABC123"
            maxLength={10}
            autoComplete="off"
            autoCapitalize="characters"
            className={`${inputCls} max-w-48 font-mono uppercase tracking-widest`}
          />
          <button type="submit" disabled={pending || plateInput.length < 6} className={btnPrimary}>
            Registrar {mode === "ingreso" ? "ingreso" : "salida"}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">
          La voz la procesa el navegador (en Chrome, los servidores de Google). Cada movimiento queda registrado.
        </p>
      </div>

      {result && (
        <div role="status" className={`rounded-xl border-2 p-4 md:p-5 ${tone[result.status]}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {result.direction === "ingreso" ? "Ingreso" : "Salida"} · {result.method === "voz" ? "por voz" : "manual"}
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">{heading[result.status]}</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-ink">{result.plate}</p>

          {result.unit && (
            <p className="mt-2 text-base font-semibold text-ink">
              {result.unit}
              {result.vehicle && (
                <span className="font-normal text-muted">
                  {" "}
                  · {[kindLabel[result.vehicle.kind], result.vehicle.brand, result.vehicle.color].filter(Boolean).join(" · ")}
                </span>
              )}
            </p>
          )}
          {result.message && <p className="mt-2 text-sm font-medium text-ink">{result.message}</p>}
          {result.status === "no_registrada" && (
            <p className="mt-2 text-sm text-ink">Esta placa no está registrada. Intento guardado en la bitácora.</p>
          )}

          {result.status === "no_registrada" && (result.suggestions?.length ?? 0) > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-ink">¿Quisiste decir…?</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {result.suggestions!.map((s) => (
                  <li key={s.plate}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(s.plate, result.direction, result.method, result.transcript)}
                      className={`${btnGhost} ${btnSm}`}
                    >
                      <span className="font-mono tracking-wider">{s.plate}</span>
                      <span className="text-muted">· {s.unit}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {result.status === "confirmar" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(result.plate, result.direction, result.method, result.transcript, true)}
                className={btnPrimary}
              >
                Registrar de todos modos
              </button>
            )}
            {result.status === "autorizado" && result.logId && !undone && (
              <button
                type="button"
                className={`${btnGhost} ${btnSm}`}
                onClick={() =>
                  startTransition(async () => {
                    const r = await undoAccess(result.logId!);
                    if (r.ok) setUndone(true);
                  })
                }
              >
                Deshacer
              </button>
            )}
            {undone && <p className="text-sm font-semibold text-ink">Movimiento anulado.</p>}
            <button type="button" className={`${btnGhost} ${btnSm}`} onClick={() => setResult(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
