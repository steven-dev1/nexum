"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// El navegador expone la API como SpeechRecognition (Chrome/Edge/Safari con prefijo webkit); TypeScript no la tipa.
type Alternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; length: number; [index: number]: Alternative };
type RecognitionEvent = { resultIndex?: number; results: { length: number; [index: number]: RecognitionResult } };
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

/** Escucha continua: se apaga sola tras este tiempo sin que nadie hable. */
const IDLE_MS = 30_000;

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
  continuous = false,
  onResult,
}: {
  lang?: string;
  /**
   * Escucha continua: el micrófono queda abierto y cada frase completa llega a `onResult`, sin cerrar entre una y otra.
   * Evita el fallo de los celulares al reabrir el micrófono (cancelan la escucha nueva). Se apaga sola tras
   * `IDLE_MS` sin hablar.
   */
  continuous?: boolean;
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
  const continuousRef = useRef(continuous);
  const idleRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Cierres seguidos muy rápidos en escucha continua (para no reabrir en bucle). */
  const quickEndsRef = useRef(0);
  /** El usuario pidió detener: un «aborted» posterior es normal y no debe reintentarse. */
  const stoppingRef = useRef(false);
  /** Cuándo terminó la última escucha: el celular necesita un respiro antes de abrir otra. */
  const lastEndRef = useRef(0);
  const beginRef = useRef<((Ctor: RecognitionCtor, attempt: number) => void) | null>(null);

  useEffect(() => {
    resultRef.current = onResult;
    continuousRef.current = continuous;
  }, [onResult, continuous]);

  const note = useCallback((event: string) => setTrail((t) => [...t.slice(-5), event]), []);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(idleRef.current);
    lastEndRef.current = Date.now();
    recRef.current = null;
    setListening(false);
    setPhase("idle");
  }, []);

  /** Termina la escucha; si el navegador no avisa que terminó (pasa en el celular), se fuerza el cierre. */
  const stop = useCallback(() => {
    stoppingRef.current = true;
    clearTimeout(timerRef.current);
    clearTimeout(idleRef.current);
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
    (Ctor: RecognitionCtor, attempt: number) => {
      let gotFinal = false;
      let failed = false;
      let retry = false;
      let lastInterim = "";
      const startedAt = Date.now();
      const isContinuous = continuousRef.current;

      /** En escucha continua se apaga sola si pasa un rato sin que nadie hable. */
      const armIdle = () => {
        if (!isContinuous) return;
        clearTimeout(idleRef.current);
        idleRef.current = setTimeout(() => {
          if (recRef.current === rec) {
            note("apagado por inactividad");
            setError("Micrófono apagado tras 30 segundos sin usarse. Toca para encenderlo.");
            stop();
          }
        }, IDLE_MS);
      };

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = isContinuous;
      rec.interimResults = true;
      rec.maxAlternatives = 5;

      rec.onaudiostart = () => {
        if (recRef.current !== rec) return;
        note("micrófono activo");
        setPhase("waiting");
        // Ya hay audio: el temporizador de «sin respuesta» no aplica.
        if (isContinuous) {
          clearTimeout(timerRef.current);
          armIdle();
        }
      };
      rec.onspeechstart = () => {
        if (recRef.current !== rec) return;
        note("voz detectada");
        setPhase("hearing");
        armIdle(); // si hay voz, el contador de inactividad vuelve a empezar
      };
      rec.onresult = (e) => {
        if (recRef.current !== rec) return;
        // Solo las frases nuevas (en escucha continua el navegador entrega la lista acumulada).
        const from = e.resultIndex ?? e.results.length - 1;
        for (let i = Math.max(0, from); i < e.results.length; i++) {
          const item = e.results[i];
          if (!item.isFinal) {
            lastInterim = item[0]?.transcript ?? "";
            setInterim(lastInterim);
            continue;
          }
          gotFinal = true;
          lastInterim = "";
          note("resultado");
          const alternatives = Array.from({ length: item.length }, (_, k) => item[k].transcript).filter(Boolean);
          setInterim(alternatives[0] ?? "");
          if (alternatives.length) resultRef.current(alternatives);
          if (isContinuous) {
            quickEndsRef.current = 0;
            armIdle();
          } else {
            // Ya hay resultado: se cierra la escucha sin esperar al silencio del navegador.
            stop();
          }
        }
      };
      rec.onnomatch = () => {
        if (recRef.current === rec) setError("No se entendió. Habla claro y vuelve a intentar.");
      };
      rec.onerror = (e) => {
        if (recRef.current !== rec) return;
        note(`error: ${e.error}`);
        // En escucha continua «no-speech» solo significa que nadie habló: se vuelve a abrir sin mostrar error.
        if (isContinuous && e.error === "no-speech" && !stoppingRef.current) return;
        // Los celulares a veces cancelan la sesión recién abierta («aborted»): se reintenta una vez, en silencio.
        if (e.error === "aborted" && !stoppingRef.current && !gotFinal && !lastInterim && attempt < 2) {
          retry = true;
          return;
        }
        failed = true;
        if (e.error !== "aborted") setError(ERRORS[e.error] ?? `No se pudo usar el reconocimiento de voz (${e.error}).`);
      };
      rec.onend = () => {
        // Una sesión vieja no debe cerrar la nueva.
        if (recRef.current !== rec) return;
        note("fin");
        // Escucha continua: el navegador la cierra de vez en cuando; se reabre sola mientras siga activada.
        if (isContinuous && !stoppingRef.current && !failed && !retry) {
          quickEndsRef.current = Date.now() - startedAt < 2500 ? quickEndsRef.current + 1 : 0;
          if (quickEndsRef.current >= 3) {
            reset();
            setError("El micrófono se cerró varias veces seguidas. Toca para volver a activarlo.");
            return;
          }
          recRef.current = null;
          note("reabriendo");
          timerRef.current = setTimeout(() => beginRef.current?.(Ctor, 0), 700);
          return;
        }
        if (retry) {
          // Se vuelve a abrir tras una pausa; la pantalla sigue en «escuchando».
          recRef.current = null;
          note("reintentando");
          timerRef.current = setTimeout(() => beginRef.current?.(Ctor, attempt + 1), 600);
          return;
        }
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

  useEffect(() => {
    beginRef.current = begin;
  }, [begin]);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    // Se descarta cualquier sesión anterior que haya quedado abierta.
    clearTimeout(timerRef.current);
    const hadPrevious = recRef.current !== null;
    if (recRef.current) discard(recRef.current);
    recRef.current = null;
    stoppingRef.current = false;
    quickEndsRef.current = 0;
    clearTimeout(idleRef.current);

    setError(null);
    setInterim("");
    setPhase("waiting");
    setTrail([]);
    setListening(true);

    // Si el teléfono sigue hablando la respuesta anterior, se calla y se espera a que libere el audio.
    const cutVoice = silenceSynthesis();
    if (cutVoice) note("voz de respuesta cortada");
    // Abrir una escucha justo después de cerrar otra hace que el celular cancele la nueva: se deja una pausa.
    const sinceEnd = Date.now() - lastEndRef.current;
    const wait = Math.max(cutVoice || hadPrevious ? 600 : 0, sinceEnd < 1200 ? 1200 - sinceEnd : 0);
    if (wait > 0) {
      timerRef.current = setTimeout(() => begin(Ctor, 0), wait);
    } else {
      begin(Ctor, 0);
    }
  }, [begin, note]);

  // Libera el micrófono y los temporizadores al salir de la pantalla.
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      clearTimeout(idleRef.current);
      if (recRef.current) discard(recRef.current);
    },
    [],
  );

  return { supported, listening, interim, error, phase, trail, start, stop };
}
