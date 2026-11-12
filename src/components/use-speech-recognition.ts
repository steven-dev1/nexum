"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// El navegador expone la API como SpeechRecognition (Chrome/Edge/Safari con prefijo webkit); TypeScript no la tipa.
type Alternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; length: number; [index: number]: Alternative };
type RecognitionEvent = { results: { length: number; [index: number]: RecognitionResult } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const noopSubscribe = () => () => {};

const ERRORS: Record<string, string> = {
  "not-allowed": "El navegador no tiene permiso para usar el micrófono. Actívalo en la barra de direcciones.",
  "service-not-allowed": "El navegador no tiene permiso para usar el micrófono.",
  "no-speech": "No se escuchó nada. Intenta de nuevo.",
  "audio-capture": "No se encontró un micrófono.",
  network: "Sin conexión con el servicio de voz del navegador.",
};

/**
 * Reconocimiento de voz del navegador (Web Speech API). `onResult` recibe las hipótesis del reconocedor
 * (de la mejor a la peor) cuando la persona termina de hablar. `supported` es false en navegadores sin la API
 * (p. ej. Firefox) y en el servidor.
 */
export function useSpeechRecognition({
  lang = "es-CO",
  onResult,
}: {
  lang?: string;
  onResult: (alternatives: string[]) => void;
}) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => getCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const resultRef = useRef(onResult);

  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current) return;
    setError(null);
    setInterim("");

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 5;

    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (!last.isFinal) {
        setInterim(last[0]?.transcript ?? "");
        return;
      }
      const alternatives = Array.from({ length: last.length }, (_, i) => last[i].transcript).filter(Boolean);
      setInterim(alternatives[0] ?? "");
      if (alternatives.length) resultRef.current(alternatives);
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") setError(ERRORS[e.error] ?? "No se pudo usar el reconocimiento de voz.");
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, [lang]);

  // Libera el micrófono al salir de la pantalla.
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
