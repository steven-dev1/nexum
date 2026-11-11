"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { pickerTriggerCls, popoverPanelCls, useAnchoredPopover } from "@/components/use-anchored-popover";
import { todayBogota } from "@/lib/format";

// Fechas como texto "YYYY-MM-DD" (sin zona horaria) para evitar corrimientos de día.
type YMD = { y: number; m: number; d: number }; // m: 0-11

const parse = (s: string): YMD | null => {
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
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Props = {
  name: string;
  required?: boolean;
  /** Fecha mínima seleccionable (YYYY-MM-DD). */
  min?: string;
  defaultValue?: string;
  placeholder?: string;
};

/** Selector de fecha con calendario propio (en español, semana de domingo a sábado, claro/oscuro). */
export function DatePicker({ name, required, min, defaultValue = "", placeholder = "Elige una fecha" }: Props) {
  const { id, triggerRef, popoverRef, open, close } = useAnchoredPopover();
  const [value, setValue] = useState(defaultValue);
  const selected = parse(value);
  const minDate = min ? parse(min) : null;
  const today = useMemo(() => parse(todayBogota())!, []);
  const [focused, setFocused] = useState<YMD>(selected ?? (minDate && toStr(minDate) > toStr(today) ? minDate : today));
  const gridRef = useRef<HTMLDivElement>(null);

  const isDisabled = (v: YMD) => !!minDate && toStr(v) < toStr(minDate);

  // Al abrir, el calendario se ubica en la fecha elegida (o hoy / la mínima) y la enfoca.
  const resetFocus = () => setFocused(selected ?? (minDate && toStr(minDate) > toStr(today) ? minDate : today));

  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${toStr(focused)}"]`)?.focus();
  }, [open, focused]);

  // 6 semanas que empiezan en domingo y contienen el mes visible.
  const days = useMemo(() => {
    const first = { y: focused.y, m: focused.m, d: 1 };
    const start = addDays(first, -utc(first).getUTCDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [focused.y, focused.m]);

  function choose(v: YMD) {
    if (isDisabled(v)) return;
    setValue(toStr(v));
    close();
  }

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
      setFocused(move());
    }
  }

  const navBtn =
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        onClick={() => !open && resetFocus()}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={selected ? `Fecha: ${fmtLong.format(utc(selected))}` : placeholder}
        className={pickerTriggerCls}
      >
        <svg
          className="size-[18px] shrink-0 text-primary-ink"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className={`flex-1 truncate ${selected ? "" : "text-muted/70"}`}>
          {selected ? capitalize(fmtShort.format(utc(selected))) : placeholder}
        </span>
        <svg
          className="size-4 shrink-0 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Lleva el valor en el formulario y hace cumplir `required` con la validación nativa. */}
      <input
        name={name}
        value={value}
        required={required}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        onFocus={() => triggerRef.current?.focus()}
      />

      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Elegir fecha"
        className={`${popoverPanelCls} w-[19rem]`}
      >
        {open && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                className={navBtn}
                aria-label="Mes anterior"
                onClick={() => setFocused(addMonths(focused, -1))}
              >
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
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <p className="text-sm font-bold text-ink" aria-live="polite">
                {capitalize(fmtMonth.format(utc({ ...focused, d: 1 })))}
              </p>
              <button
                type="button"
                className={navBtn}
                aria-label="Mes siguiente"
                onClick={() => setFocused(addMonths(focused, 1))}
              >
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
                  <path d="m9 18 6-6-6-6" />
                </svg>
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

            <div ref={gridRef} role="grid" onKeyDown={onKeyDown} className="grid grid-cols-7 gap-0.5">
              {days.map((v) => {
                const key = toStr(v);
                const inMonth = v.m === focused.m;
                const isSelected = value === key;
                const isToday = toStr(today) === key;
                const disabled = isDisabled(v);
                return (
                  <button
                    key={key}
                    type="button"
                    data-day={key}
                    tabIndex={key === toStr(focused) ? 0 : -1}
                    disabled={disabled}
                    aria-pressed={isSelected}
                    aria-label={capitalize(fmtLong.format(utc(v)))}
                    onClick={() => choose(v)}
                    onFocus={() => key !== toStr(focused) && setFocused(v)}
                    className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 ${
                      isSelected
                        ? "bg-primary font-bold text-on-primary"
                        : `${inMonth ? "text-ink" : "text-muted/60"} hover:bg-surface-2 ${isToday ? "font-bold text-primary-ink" : ""}`
                    }`}
                  >
                    {v.d}
                    {isToday && !isSelected && (
                      <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex justify-between border-t border-line pt-2">
              <button
                type="button"
                onClick={() => choose(today)}
                disabled={isDisabled(today)}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Hoy
              </button>
              {value && !required && (
                <button
                  type="button"
                  onClick={() => {
                    setValue("");
                    close();
                  }}
                  className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
                >
                  Borrar
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
