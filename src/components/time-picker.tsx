"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { pickerTriggerCls, popoverPanelCls, useAnchoredPopover } from "@/components/use-anchored-popover";

const fmt = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });

/** "18:30" → "6:30 p. m." */
export function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return fmt.format(Date.UTC(2000, 0, 1, h, m));
}

const PERIODS = [
  { label: "Madrugada", from: 0 },
  { label: "Mañana", from: 6 },
  { label: "Tarde", from: 12 },
  { label: "Noche", from: 18 },
];

type Props = {
  name: string;
  required?: boolean;
  defaultValue?: string;
  /** Intervalo entre opciones, en minutos. */
  step?: 15 | 30 | 60;
  placeholder?: string;
};

/** Selector de hora con lista agrupada por franja del día (formato 12 h, como en Colombia). */
export function TimePicker({ name, required, defaultValue = "", step = 30, placeholder = "Hora" }: Props) {
  const { id, triggerRef, popoverRef, open, close } = useAnchoredPopover();
  const [value, setValue] = useState(defaultValue);
  const listRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () =>
      Array.from({ length: (24 * 60) / step }, (_, i) => {
        const minutes = i * step;
        return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      }),
    [step],
  );

  // Al abrir, centra y enfoca la hora elegida (o las 8:00 a. m. si no hay).
  useEffect(() => {
    if (!open) return;
    const target =
      listRef.current?.querySelector<HTMLButtonElement>(`[data-time="${value}"]`) ??
      listRef.current?.querySelector<HTMLButtonElement>('[data-time="08:00"]');
    target?.scrollIntoView({ block: "center" });
    target?.focus({ preventScroll: true });
  }, [open, value]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-time]") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[Math.min(buttons.length - 1, Math.max(0, index + (e.key === "ArrowDown" ? 1 : -1)))];
    next?.focus();
    next?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={value ? `Hora: ${formatTime(value)}` : placeholder}
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
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        {/* El formato "a. m./p. m." puede variar entre el ICU del servidor y el del navegador. */}
        <span suppressHydrationWarning className={`flex-1 truncate ${value ? "" : "text-muted/70"}`}>
          {value ? formatTime(value) : placeholder}
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

      <div ref={popoverRef} id={id} popover="auto" className={`${popoverPanelCls} w-56 !p-1.5`}>
        <div
          ref={listRef}
          role="listbox"
          aria-label="Elegir hora"
          onKeyDown={onKeyDown}
          className="max-h-72 overflow-y-auto overscroll-contain"
        >
          {open &&
            PERIODS.map((period, pi) => {
              const to = PERIODS[pi + 1]?.from ?? 24;
              const group = options.filter((o) => {
                const h = Number(o.slice(0, 2));
                return h >= period.from && h < to;
              });
              return (
                <div key={period.label} role="group" aria-label={period.label}>
                  <p className="sticky top-0 z-10 bg-surface px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {period.label}
                  </p>
                  {group.map((t) => {
                    const selected = t === value;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-time={t}
                        onClick={() => {
                          setValue(t);
                          close();
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          selected ? "bg-primary font-semibold text-on-primary" : "text-ink hover:bg-surface-2"
                        }`}
                      >
                        {formatTime(t)}
                        {selected && (
                          <svg
                            className="size-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="m5 12 5 5L20 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
