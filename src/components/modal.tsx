"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { btnAccent } from "@/components/ui";

type ModalApi = {
  close: () => void;
  /** Cierra el modal y muestra un aviso breve de éxito. */
  succeed: (message?: string) => void;
};

const ModalContext = createContext<ModalApi | null>(null);

/** Disponible para los formularios dentro de un <Modal>. Fuera de un modal devuelve null. */
export function useModal() {
  return useContext(ModalContext);
}

const icons = {
  package: (
    <>
      <path d="m21 8-9-5-9 5v8l9 5 9-5V8z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </>
  ),
  trees: (
    <>
      <path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" />
      <path d="M7 16v6M13 19v3" />
      <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
} as const;

export type ModalIcon = keyof typeof icons;

type Props = {
  title: string;
  description?: string;
  icon?: ModalIcon;
  /** Contenido del botón que abre el modal (texto o, p. ej., una miniatura). Sin él, el modal se controla con `open`. */
  trigger?: ReactNode;
  /** Nombre accesible del botón cuando `trigger` no es texto. */
  triggerLabel?: string;
  /** Muestra un ícono "+" en el botón (acciones de creación). */
  plus?: boolean;
  triggerClassName?: string;
  size?: "md" | "lg";
  /** Abre el modal al montarse (p. ej. al llegar desde un enlace «Invitar»). */
  defaultOpen?: boolean;
  /** Modo controlado: un solo modal compartido por muchas filas (junto con `onOpenChange`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

/**
 * Modal accesible sobre <dialog> nativo (foco atrapado, Escape, capa superior).
 * El <dialog> ocupa toda la ventana sin estilos propios; el fondo y el panel son
 * elementos internos con utilidades de Tailwind. Centrado en escritorio y hoja
 * inferior en celular. El contenido se monta solo mientras está abierto.
 */
export function Modal({
  title,
  description,
  icon,
  trigger,
  triggerLabel,
  plus = false,
  triggerClassName,
  size = "md",
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = controlledOpen ?? innerOpen;
  const setOpen = useCallback(
    (value: boolean) => {
      setInnerOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );
  const [toast, setToast] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const close = useCallback(() => ref.current?.close(), []);
  const succeed = useCallback((message?: string) => {
    if (message) setToast(message);
    ref.current?.close();
  }, []);
  const api = useMemo(() => ({ close, succeed }), [close, succeed]);

  return (
    <>
      {trigger !== undefined && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={triggerLabel}
          className={triggerClassName ?? btnAccent}
        >
          {plus && (
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
          {trigger}
        </button>
      )}

      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-ink backdrop:bg-transparent"
      >
        {open && (
          <div className="flex h-full w-full items-end justify-center sm:items-center sm:p-6">
            {/* Fondo: clic para cerrar. */}
            <div
              aria-hidden
              onClick={close}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px] transition-opacity duration-200 starting:opacity-0"
            />

            <div
              className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl shadow-slate-950/50 transition-[opacity,transform] duration-200 ease-out starting:translate-y-8 starting:opacity-0 sm:max-h-[min(88dvh,52rem)] sm:rounded-2xl sm:starting:translate-y-3 sm:starting:scale-[0.98] ${
                size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
              }`}
            >
              <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line sm:hidden" />

              <header className="flex shrink-0 items-start gap-3.5 px-6 pb-5 pt-4 sm:pt-6">
                {icon && (
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
                    <svg
                      className="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      {icons[icon]}
                    </svg>
                  </span>
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id={titleId} className="text-lg font-bold leading-6 text-ink">
                    {title}
                  </h2>
                  {description && (
                    <p id={descriptionId} className="mt-1 text-sm leading-5 text-muted">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="-mr-2 -mt-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <svg
                    className="size-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <ModalContext value={api}>{children}</ModalContext>
            </div>
          </div>
        )}
      </dialog>

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-bg shadow-lg transition-[opacity,transform] duration-200 starting:translate-y-2 starting:opacity-0 md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
        >
          <span
            className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink"
            aria-hidden
          >
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          {toast}
        </div>
      )}
    </>
  );
}
