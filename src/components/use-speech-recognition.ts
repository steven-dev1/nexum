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
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onnomatch: (() => void) | null;
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
  /** Qué está pasando: esperando que hables o ya detectando voz (sirve para saber si el micrófono capta). */
  const [phase, setPhase] = useState<"idle" | "waiting" | "hearing">("idle");
  const recRef = useRef<Recognition | null>(null);
  const resultRef = useRef(onResult);

  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  /** Termina la escucha; si el navegador no avisa que terminó (pasa en el celular), se fuerza el cierre. */
  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    rec.stop();
    setTimeout(() => {
      if (recRef.current === rec) {
        rec.abort();
        recRef.current = null;
        setListening(false);
        setPhase("idle");
      }
    }, 1500);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    // Si quedó una sesión anterior sin cerrar, se descarta: antes esto dejaba el micrófono sin responder.
    const previous = recRef.current;
    if (previous) {
      recRef.current = null;
      previous.onresult = previous.onerror = previous.onend = null;
      previous.onaudiostart = previous.onspeechstart = previous.onnomatch = null;
      try {
        previous.abort();
      } catch {
        /* ya estaba cerrada */
      }
    }
    // Si el teléfono sigue hablando la respuesta anterior, el micrófono puede quedar bloqueado: se calla primero.
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* sin síntesis de voz */
    }
    setError(null);
    setInterim("");
    setPhase("waiting");
    let gotFinal = false;
    let lastInterim = "";
    let failed = false;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 5;

    rec.onresult = (e) => {
      if (recRef.current !== rec) return;
      const last = e.results[e.results.length - 1];
      if (!last.isFinal) {
        lastInterim = last[0]?.transcript ?? "";
        setInterim(lastInterim);
        return;
      }
      gotFinal = true;
      const alternatives = Array.from({ length: last.length }, (_, i) => last[i].transcript).filter(Boolean);
      setInterim(alternatives[0] ?? "");
      if (alternatives.length) resultRef.current(alternatives);
      // Ya hay resultado: se cierra la escucha sin esperar al silencio del navegador.
      stop();
    };
    rec.onerror = (e) => {
      if (recRef.current !== rec) return;
      failed = true;
      if (e.error !== "aborted") setError(ERRORS[e.error] ?? `No se pudo usar el reconocimiento de voz (${e.error}).`);
    };
    rec.onaudiostart = () => recRef.current === rec && setPhase("waiting");
    rec.onspeechstart = () => recRef.current === rec && setPhase("hearing");
    rec.onnomatch = () => {
      if (recRef.current === rec) setError("No se entendió. Habla claro y vuelve a intentar.");
    };
    rec.onend = () => {
      // Una sesión vieja no debe cerrar la nueva.
      if (recRef.current !== rec) return;
      recRef.current = null;
      setListening(false);
      setPhase("idle");
      // En algunos celulares la escucha termina sin resultado final: se usa lo último que se alcanzó a oír.
      if (!gotFinal && lastInterim) {
        resultRef.current([lastInterim]);
      } else if (!gotFinal && !failed) {
        setError("No se captó la voz. Toca el micrófono y habla de inmediato.");
      }
    };

    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
      setPhase("idle");
    }
  }, [lang, stop]);

  // Libera el micrófono al salir de la pantalla.
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, error, phase, start, stop };
}
