"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Popover nativo (atributo `popover`) anclado a su botón disparador.
 * Vive en la capa superior, así que no lo recorta el scroll de un modal; la
 * posición se calcula con el rectángulo del botón y se voltea hacia arriba
 * si no cabe debajo. Cierre con Escape o clic fuera (light dismiss del navegador).
 */
export function useAnchoredPopover() {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const margin = 8;
    const { offsetWidth: w, offsetHeight: h } = popover;

    let top = rect.bottom + gap;
    if (top + h > window.innerHeight - margin && rect.top - gap - h > margin) {
      top = rect.top - gap - h;
    }
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - w - margin));

    popover.style.top = `${Math.max(margin, top)}px`;
    popover.style.left = `${left}px`;
  }, []);

  // Sincroniza el estado con el popover nativo (se abre con popoverTarget, se cierra solo).
  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === "open");
    popover.addEventListener("toggle", onToggle);
    return () => popover.removeEventListener("toggle", onToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    position();
    const update = () => position();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, position]);

  /** Cierra y devuelve el foco al botón disparador. */
  const close = useCallback(() => {
    popoverRef.current?.hidePopover();
    triggerRef.current?.focus();
  }, []);

  return { id, triggerRef, popoverRef, open, close };
}

/** Clases para el panel flotante (anulan los estilos por defecto del navegador para [popover]). */
export const popoverPanelCls =
  "fixed inset-auto m-0 rounded-2xl border border-line bg-surface p-3 text-ink shadow-xl shadow-slate-950/25 transition-[opacity,transform] duration-150 starting:-translate-y-1 starting:opacity-0";

/** Disparador con aspecto de campo de texto. */
export const pickerTriggerCls =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-left text-[15px] text-ink transition-[border-color,box-shadow] hover:border-muted/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 focus-visible:outline-none aria-expanded:border-primary aria-expanded:ring-4 aria-expanded:ring-primary/20";
