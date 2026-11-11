"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { btnAccent, btnPrimary } from "@/components/ui";

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

/** Formulario con Server Action: muestra error/éxito y estado de envío. */
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

  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p
          role="status"
          className="rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success"
        >
          {state.ok}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={buttonClassName ?? (variant === "accent" ? btnAccent : btnPrimary)}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
