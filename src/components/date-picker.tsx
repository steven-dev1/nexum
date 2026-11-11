"use client";

import { useState } from "react";
import { Calendar, formatDateLong, formatDateShort } from "@/components/calendar";
import { pickerTriggerCls, popoverPanelCls, useAnchoredPopover } from "@/components/use-anchored-popover";
import { todayBogota } from "@/lib/format";

type Props = {
  name: string;
  required?: boolean;
  /** Fecha mínima seleccionable (YYYY-MM-DD). */
  min?: string;
  defaultValue?: string;
  /** Modo controlado (junto con onChange). */
  value?: string;
  onChange?: (value: string) => void;
  /** Días marcados (YYYY-MM-DD → cantidad), p. ej. días con reservas. */
  marks?: Record<string, number>;
  /** Texto de la leyenda de los días marcados. */
  marksLabel?: string;
  placeholder?: string;
};

/** Selector de fecha con el calendario de la app en un panel flotante. */
export function DatePicker({
  name,
  required,
  min,
  defaultValue = "",
  value,
  onChange,
  marks,
  marksLabel = "Con reservas",
  placeholder = "Elige una fecha",
}: Props) {
  const { id, triggerRef, popoverRef, open, close } = useAnchoredPopover();
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const today = todayBogota();
  const todayDisabled = !!min && today < min;

  function choose(date: string) {
    if (value === undefined) setInner(date);
    onChange?.(date);
    close();
  }

  const hasMarks = marks && Object.keys(marks).length > 0;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={current ? `Fecha: ${formatDateLong(current)}` : placeholder}
        className={pickerTriggerCls}
      >
        <svg className="size-[18px] shrink-0 text-primary-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span suppressHydrationWarning className={`flex-1 truncate ${current ? "" : "text-muted/70"}`}>
          {current ? formatDateShort(current) : placeholder}
        </span>
        <svg className="size-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Lleva el valor en el formulario y hace cumplir `required` con la validación nativa. */}
      <input
        name={name}
        value={current}
        required={required}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        onFocus={() => triggerRef.current?.focus()}
      />

      <div ref={popoverRef} id={id} popover="auto" role="dialog" aria-label="Elegir fecha" className={`${popoverPanelCls} w-[19rem]`}>
        {/* Se monta al abrir: cada apertura empieza en la fecha elegida (o hoy). */}
        {open && (
          <Calendar
            value={current}
            onSelect={choose}
            min={min}
            marks={marks}
            autoFocus
            footer={
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => choose(today)}
                  disabled={todayDisabled}
                  className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Hoy
                </button>
                {hasMarks && (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                    {marksLabel}
                  </span>
                )}
                {current && !required && (
                  <button
                    type="button"
                    onClick={() => choose("")}
                    className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    Borrar
                  </button>
                )}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
