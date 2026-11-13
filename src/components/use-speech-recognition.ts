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

/** Corta cualquier voz de respuesta que esté sonando (si sigue sonando, el micrófono puede quedar sin audio). */
function silenceSynthesis(): boolean {
  try {
    const synth = window.speechSynthesis;
    if (synth && (synth.speaking || synth.pending)) {
      synth.cancel();
      return true;
    }
  } catch {
    /* sin síntesis de voz */
  }
  return false;
}

/** Cierra una sesión de reconocimiento sin que sus eventos viejos afecten a la nueva. */
function discard(rec: Recognition) {
  rec.onresult = rec.onerror = rec.onend = rec.onaudiostart = rec.onspeechstart = rec.onnomatch = null;
  try {
    rec.abort();
  } catch {
    /* ya estaba cerrada */
  }
}

/**
 * Reconocimiento de voz del navegador (Web Speech API). `onResult` recibe las hipótesis del reconocedor
 * (de la mejor a la peor) cuando la persona termina de hablar. `supported` es false en navegadores sin la API
 * (p. ej. Firefox) y en el servidor. `trail` son los últimos eventos del reconocedor, para diagnosticar.
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
  /** Esperando que hables o ya detectando voz (sirve para saber si el micrófono capta). */
  const [phase, setPhase] = useState<"idle" | "waiting" | "hearing">("idle");
  const [trail, setTrail] = useState<string[]>([]);
  const recRef = useRef<Recognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resultRef = useRef(onResult);

  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  const note = useCallback((event: string) => setTrail((t) => [...t.slice(-5), event]), []);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    recRef.current = null;
    setListening(false);
    setPhase("idle");
  }, []);

  /** Termina la escucha; si el navegador no avisa que terminó (pasa en el celular), se fuerza el cierre. */
  const stop = useCallback(() => {
    clearTimeout(timerRef.current);
    const rec = recRef.current;
    if (!rec) {
      reset(); // p. ej. se tocó «detener» mientras se esperaba a liberar el audio
      return;
    }
    try {
      rec.stop();
    } catch {
      /* ya estaba cerrada */
    }
    timerRef.current = setTimeout(() => {
      if (recRef.current === rec) {
        discard(rec);
        reset();
      }
    }, 1500);
  }, [reset]);

  const begin = useCallback(
    (Ctor: RecognitionCtor) => {
      let gotFinal = false;
      let failed = false;
      let lastInterim = "";

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 5;

      rec.onaudiostart = () => {
        if (recRef.current !== rec) return;
        note("micrófono activo");
        setPhase("waiting");
      };
      rec.onspeechstart = () => {
        if (recRef.current !== rec) return;
        note("voz detectada");
        setPhase("hearing");
      };
      rec.onresult = (e) => {
        if (recRef.current !== rec) return;
        const last = e.results[e.results.length - 1];
        if (!last.isFinal) {
          lastInterim = last[0]?.transcript ?? "";
          setInterim(lastInterim);
          return;
        }
        gotFinal = true;
        note("resultado");
        const alternatives = Array.from({ length: last.length }, (_, i) => last[i].transcript).filter(Boolean);
        setInterim(alternatives[0] ?? "");
        if (alternatives.length) resultRef.current(alternatives);
        // Ya hay resultado: se cierra la escucha sin esperar al silencio del navegador.
        stop();
      };
      rec.onnomatch = () => {
        if (recRef.current === rec) setError("No se entendió. Habla claro y vuelve a intentar.");
      };
      rec.onerror = (e) => {
        if (recRef.current !== rec) return;
        note(`error: ${e.error}`);
        failed = true;
        if (e.error !== "aborted") setError(ERRORS[e.error] ?? `No se pudo usar el reconocimiento de voz (${e.error}).`);
      };
      rec.onend = () => {
        // Una sesión vieja no debe cerrar la nueva.
        if (recRef.current !== rec) return;
        note("fin");
        reset();
        // En algunos celulares la escucha termina sin resultado final: se usa lo último que se alcanzó a oír.
        if (!gotFinal && lastInterim) resultRef.current([lastInterim]);
        else if (!gotFinal && !failed) setError("No se captó la voz. Toca el micrófono y habla de inmediato.");
      };

      recRef.current = rec;
      // Si el navegador no reporta nada en 10 s, se libera para no dejar el micrófono «colgado» en rojo.
      timerRef.current = setTimeout(() => {
        if (recRef.current === rec) {
          note("sin respuesta del navegador");
          setError("El navegador no respondió. Toca el micrófono de nuevo.");
          discard(rec);
          reset();
        }
      }, 10_000);
      try {
        rec.start();
        note("start()");
      } catch (e) {
        note(`start falló: ${e instanceof Error ? e.name : "error"}`);
        setError("No se pudo iniciar el micrófono. Toca de nuevo.");
        discard(rec);
        reset();
      }
    },
    [lang, note, reset, stop],
  );

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    // Se descarta cualquier sesión anterior que haya quedado abierta.
    clearTimeout(timerRef.current);
    if (recRef.current) discard(recRef.current);
    recRef.current = null;

    setError(null);
    setInterim("");
    setPhase("waiting");
    setTrail([]);
    setListening(true);

    // Si el teléfono sigue hablando la respuesta anterior, se calla y se espera a que libere el audio.
    if (silenceSynthesis()) {
      note("voz de respuesta cortada");
      timerRef.current = setTimeout(() => begin(Ctor), 500);
    } else {
      begin(Ctor);
    }
  }, [begin, note]);

  // Libera el micrófono y los temporizadores al salir de la pantalla.
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      if (recRef.current) discard(recRef.current);
    },
    [],
  );

  return { supported, listening, interim, error, phase, trail, start, stop };
}
