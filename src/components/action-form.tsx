"use client";

import { startTransition, useActionState, useEffect, type FormEvent, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { btnAccent, btnGhost, btnPrimary, scrollCls } from "@/components/ui";
import { useModal } from "@/components/modal";
import { useOnline } from "@/components/use-online";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "accent";
  className?: string;
  /** Reemplaza el estilo del botón (p. ej. versión compacta en filas de tabla). */
  buttonClassName?: string;
  children: ReactNode;
};

/**
 * Formulario con Server Action: muestra error/éxito y estado de envío.
 * Dentro de un <Modal> usa el diseño del modal (cuerpo con scroll + pie con
 * Cancelar/Enviar) y lo cierra al tener éxito.
 *
 * Se envía con startTransition en lugar de `<form action>` para que React no
 * vacíe los campos cuando la acción devuelve un error.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Guardando…",
  variant = "primary",
  className = "space-y-4",
  buttonClassName,
  children,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const modal = useModal();
  const online = useOnline();

  useEffect(() => {
    if (state?.ok && modal) modal.succeed(state.ok);
  }, [state, modal]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  const offline = !online && (
    <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-ink">
      Sin conexión: no se puede guardar hasta volver a conectarte.
    </p>
  );

  const error = state?.error && (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
      {state.error}
    </p>
  );

  const submit = (
    <button
      type="submit"
      disabled={pending || !online}
      className={buttonClassName ?? (variant === "accent" ? btnAccent : btnPrimary)}
    >
      {pending ? pendingLabel : submitLabel}
    </button>
  );

  if (modal) {
    return (
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className={`min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-line px-6 py-5 ${scrollCls}`}>
          {children}
          {offline}
          {error}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end">
          <button type="button" onClick={modal.close} className={btnGhost}>
            Cancelar
          </button>
          {submit}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
      {offline}
      {error}
      {state?.ok && (
        <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
          {state.ok}
        </p>
      )}
      {submit}
    </form>
  );
}
