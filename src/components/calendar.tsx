"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { todayBogota } from "@/lib/format";

// Fechas como texto "YYYY-MM-DD" (sin zona horaria) para evitar corrimientos de día.
type YMD = { y: number; m: number; d: number }; // m: 0-11

export const parseYMD = (s: string): YMD | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return match ? { y: +match[1], m: +match[2] - 1, d: +match[3] } : null;
};
const toStr = ({ y, m, d }: YMD) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const fromUTC = (date: Date): YMD => ({ y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() });
const addDays = (v: YMD, n: number) => fromUTC(new Date(Date.UTC(v.y, v.m, v.d + n)));
const addMonths = (v: YMD, n: number) => {
  const first = new Date(Date.UTC(v.y, v.m + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return { y: first.getUTCFullYear(), m: first.getUTCMonth(), d: Math.min(v.d, last) };
};
const utc = (v: YMD) => new Date(Date.UTC(v.y, v.m, v.d));

const fmtLong = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const fmtShort = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fmtMonth = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-11-20" → "Viernes, 20 de noviembre de 2026" */
export const formatDateLong = (s: string) => {
  const v = parseYMD(s);
  return v ? capitalize(fmtLong.format(utc(v))) : s;
};
/** "2026-11-20" → "Vie, 20 nov 2026" */
export const formatDateShort = (s: string) => {
  const v = parseYMD(s);
  return v ? capitalize(fmtShort.format(utc(v))) : s;
};

type Props = {
  /** Fecha elegida (YYYY-MM-DD). */
  value?: string;
  onSelect: (date: string) => void;
  /** Fecha mínima seleccionable (YYYY-MM-DD). */
  min?: string;
  /** Días marcados (YYYY-MM-DD → cantidad), p. ej. días con reservas. */
  marks?: Record<string, number>;
  /** Enfoca el día activo al montar (al abrir dentro de un popover). */
  autoFocus?: boolean;
  /** Celdas grandes con la cantidad de marcas (vista de calendario en página). */
  size?: "sm" | "lg";
  footer?: ReactNode;
  /**
   * Hoy (YYYY-MM-DD). Si el calendario se renderiza en el servidor, pásalo desde
   * la petición para que servidor y navegador coincidan; si no, se calcula aquí.
   */
  today?: string;
};

/**
 * Calendario mensual en español (domingo a sábado) con teclado:
 * flechas, Re Pág/Av Pág (mes), Inicio/Fin (semana) y Enter.
 */
export function Calendar({
  value,
  onSelect,
  min,
  marks,
  autoFocus = false,
  size = "sm",
  footer,
  today: todayProp,
}: Props) {
  const today = useMemo(() => parseYMD(todayProp ?? todayBogota())!, [todayProp]);
  const minDate = min ? parseYMD(min) : null;
  const selected = value ? parseYMD(value) : null;
  const [focused, setFocused] = useState<YMD>(selected ?? (minDate && toStr(minDate) > toStr(today) ? minDate : today));
  const gridRef = useRef<HTMLDivElement>(null);
  // Solo movemos el foco del navegador al montar (si autoFocus) o al navegar con el teclado.
  const moveFocus = useRef(autoFocus);

  useEffect(() => {
    if (!moveFocus.current) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${toStr(focused)}"]`)?.focus();
  }, [focused]);

  const isDisabled = (v: YMD) => !!minDate && toStr(v) < toStr(minDate);

  // 6 semanas que empiezan en domingo y contienen el mes visible.
  const days = useMemo(() => {
    const first = { y: focused.y, m: focused.m, d: 1 };
    const start = addDays(first, -utc(first).getUTCDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [focused.y, focused.m]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => YMD> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
      Home: () => addDays(focused, -utc(focused).getUTCDay()),
      End: () => addDays(focused, 6 - utc(focused).getUTCDay()),
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      moveFocus.current = true;
      setFocused(move());
    }
  }

  const lg = size === "lg";
  const navBtn =
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink";
  const chevron = (d: string) => (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className={navBtn}
          aria-label="Mes anterior"
          onClick={() => setFocused(addMonths(focused, -1))}
        >
          {chevron("m15 18-6-6 6-6")}
        </button>
        <p suppressHydrationWarning className={`font-bold text-ink ${lg ? "text-base" : "text-sm"}`} aria-live="polite">
          {capitalize(fmtMonth.format(utc({ ...focused, d: 1 })))}
        </p>
        <button
          type="button"
          className={navBtn}
          aria-label="Mes siguiente"
          onClick={() => setFocused(addMonths(focused, 1))}
        >
          {chevron("m9 18 6-6-6-6")}
        </button>
      </div>

      <div
        className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-muted"
        aria-hidden
      >
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1.5">
            {w}
          </span>
        ))}
      </div>

      <div ref={gridRef} role="grid" onKeyDown={onKeyDown} className={`grid grid-cols-7 ${lg ? "gap-1" : "gap-0.5"}`}>
        {days.map((v) => {
          const key = toStr(v);
          const inMonth = v.m === focused.m;
          const isSelected = value === key;
          const isToday = toStr(today) === key;
          const disabled = isDisabled(v);
          const count = marks?.[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              data-day={key}
              tabIndex={key === toStr(focused) ? 0 : -1}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${capitalize(fmtLong.format(utc(v)))}${count ? `, ${count} reserva${count === 1 ? "" : "s"}` : ""}`}
              suppressHydrationWarning
              onClick={() => {
                setFocused(v);
                onSelect(key);
              }}
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 ${
                lg ? "h-12 text-sm sm:h-14" : "aspect-square text-sm"
              } ${
                isSelected
                  ? "bg-primary font-bold text-on-primary"
                  : `${inMonth ? "text-ink" : "text-muted/50"} hover:bg-surface-2 ${
                      isToday ? "font-bold text-primary-ink ring-1 ring-inset ring-accent" : ""
                    } ${count && lg && inMonth ? "bg-primary-soft/60" : ""}`
              }`}
            >
              {v.d}
              {count > 0 &&
                (lg ? (
                  <span
                    aria-hidden
                    className={`mt-0.5 rounded-full px-1.5 text-[10px] font-bold leading-4 ${
                      isSelected ? "bg-on-primary/20 text-on-primary" : "bg-primary text-on-primary"
                    }`}
                  >
                    {count}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className={`absolute bottom-1 size-1.5 rounded-full ${isSelected ? "bg-on-primary" : "bg-primary"}`}
                  />
                ))}
            </button>
          );
        })}
      </div>

      {footer}
    </div>
  );
}
