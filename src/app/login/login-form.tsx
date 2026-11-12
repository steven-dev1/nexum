"use client";

import { ActionForm } from "@/components/action-form";
import { Field, inputCls } from "@/components/ui";
import { signIn } from "@/lib/actions/auth";

/** Solo inicia sesión: las cuentas nuevas se crean con un enlace de invitación de la administración. */
export function LoginForm() {
  return (
    <div>
      <ActionForm action={signIn} submitLabel="Ingresar" pendingLabel="Ingresando…">
        <Field label="Correo">
          <input name="email" type="email" autoComplete="email" required className={inputCls} />
        </Field>
        <Field label="Contraseña">
          <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
        </Field>
      </ActionForm>

      <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-center text-sm text-muted">
        ¿Eres nuevo? Pídele a la administración tu <b className="text-ink">enlace de invitación</b>.
      </p>
    </div>
  );
}
