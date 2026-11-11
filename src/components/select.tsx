"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { labelCls, scrollCls } from "@/components/ui";
import { pickerTriggerCls, popoverPanelCls, useAnchoredPopover } from "@/components/use-anchored-popover";

export type SelectOption = {
  value: string;
  /** Texto en la lista. */
  label: string;
  /** Texto secundario (gris) en la lista. */
  hint?: string;
  /** Encabezado de grupo (p. ej. "Torre 1"). Las opciones de un grupo deben ir seguidas. */
  group?: string;
  /** Texto en el campo cuando está elegida (por defecto, `label`). */
  display?: string;
  disabled?: boolean;
};

type Props = {
  name: string;
  options: SelectOption[];
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string;
  /** Modo controlado (junto con onChange). */
  value?: string;
  onChange?: (value: string) => void;
  /** Muestra buscador; por defecto, cuando hay más de 8 opciones. */
  searchable?: boolean;
  size?: "md" | "sm";
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Desplegable con el estilo de la app (reemplaza al <select> nativo).
 * Lista flotante con grupos, búsqueda sin tildes, check en la opción elegida
 * y teclado (flechas, Inicio/Fin, Enter, Esc, letra inicial). Envía su valor
 * en el formulario con un input oculto que respeta `required`.
 */
export function Select({
  name,
  options,
  label,
  hint,
  placeholder = "Selecciona…",
  required,
  disabled,
  defaultValue = "",
  value,
  onChange,
  searchable,
  size = "md",
  autoFocus,
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  const { id, triggerRef, popoverRef, open, close } = useAnchoredPopover({ matchWidth: true });
  const labelId = useId();
  const listId = useId();
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const selected = options.find((o) => o.value === current);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const canSearch = searchable ?? options.length > 8;
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Cada palabra buscada debe coincidir con el inicio de alguna palabra de la opción:
  // "2 302" o "torre 2 302" encuentran "Torre 2 · Apto 302" (y no "Torre 1 · Apto 302").
  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return options.filter((o) => {
      const tokens = normalize(`${o.group ?? ""} ${o.label} ${o.hint ?? ""}`).split(/[^\p{L}\p{N}]+/u);
      return words.every((w) => tokens.some((t) => t.startsWith(w)));
    });
  }, [options, query]);

  // Al abrir: sin filtro y con la opción elegida resaltada.
  function prepareOpen() {
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === current),
      ),
    );
  }

  useEffect(() => {
    if (!open) return;
    (canSearch ? searchRef.current : listRef.current)?.focus();
  }, [open, canSearch]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, filtered]);

  function choose(option: SelectOption | undefined) {
    if (!option || option.disabled) return;
    if (value === undefined) setInner(option.value);
    onChange?.(option.value);
    close();
  }

  function step(from: number, dir: 1 | -1) {
    for (let i = from + dir; i >= 0 && i < filtered.length; i += dir) {
      if (!filtered[i].disabled) return i;
    }
    return from;
  }

  function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => step(a, 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => step(a, -1));
        return;
      case "Home":
        if (canSearch) return;
        e.preventDefault();
        setActive(step(-1, 1));
        return;
      case "End":
        if (canSearch) return;
        e.preventDefault();
        setActive(step(filtered.length, -1));
        return;
      case "Enter":
        e.preventDefault();
        choose(filtered[active]);
        return;
      case "Tab":
        e.preventDefault();
        close();
        return;
    }
    // Sin buscador: saltar a la siguiente opción que empiece por la letra pulsada.
    if (!canSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const key = normalize(e.key);
      const n = filtered.length;
      for (let k = 1; k <= n; k++) {
        const i = (active + k) % n;
        if (!filtered[i].disabled && normalize(filtered[i].label).startsWith(key)) {
          setActive(i);
          break;
        }
      }
    }
  }

  const activeId = filtered[active] ? `${listId}-${active}` : undefined;
  const sm = size === "sm";

  return (
    <div className={`relative ${className}`}>
      {label && (
        <span id={labelId} className={labelCls}>
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        onClick={() => !open && prepareOpen()}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={label ? `${labelId} ${id}-value` : undefined}
        aria-label={label ? undefined : ariaLabel}
        className={`${pickerTriggerCls} disabled:cursor-not-allowed disabled:opacity-60 ${sm ? "!gap-2 !py-2 !text-sm" : ""}`}
      >
        <span id={`${id}-value`} className={`flex-1 truncate ${selected ? "" : "text-muted/70"}`}>
          {selected ? (selected.display ?? selected.label) : placeholder}
        </span>
        <svg
          className={`size-4 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
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
      {hint && <span className="mt-1.5 block text-xs leading-5 text-muted">{hint}</span>}

      {/* Lleva el valor en el formulario y hace cumplir `required` con la validación nativa. */}
      <input
        name={name}
        value={current}
        required={required}
        disabled={disabled}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        onFocus={() => triggerRef.current?.focus()}
      />

      <div ref={popoverRef} id={id} popover="auto" className={`${popoverPanelCls} max-w-[calc(100vw-1rem)] !p-1.5`}>
        {open && (
          <>
            {canSearch && (
              <div className="relative mb-1.5">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Buscar…"
                  aria-label="Buscar opción"
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  className="w-full rounded-lg border border-line bg-bg py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus-visible:outline-none"
                />
              </div>
            )}

            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={canSearch ? -1 : 0}
              aria-labelledby={label ? labelId : undefined}
              aria-label={label ? undefined : ariaLabel}
              aria-activedescendant={canSearch ? undefined : activeId}
              onKeyDown={canSearch ? undefined : onKeyDown}
              className={`max-h-72 overflow-y-auto overscroll-contain pr-0.5 focus:outline-none ${scrollCls}`}
            >
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Sin resultados</li>}
              {filtered.map((o, i) => {
                const isSelected = o.value === current;
                const showGroup = o.group && o.group !== filtered[i - 1]?.group;
                return (
                  <li key={o.value || "__empty"} role="presentation">
                    {showGroup && (
                      <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted first:pt-1">
                        {o.group}
                      </p>
                    )}
                    <div
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={o.disabled || undefined}
                      onMouseMove={() => !o.disabled && active !== i && setActive(i)}
                      onClick={() => choose(o)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${
                        o.disabled ? "cursor-not-allowed opacity-40" : ""
                      } ${i === active ? "bg-surface-2" : ""} ${isSelected ? "font-semibold text-primary-ink" : "text-ink"}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.hint && <span className="block truncate text-xs font-normal text-muted">{o.hint}</span>}
                      </span>
                      {isSelected && (
                        <svg
                          className="size-4 shrink-0"
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
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
