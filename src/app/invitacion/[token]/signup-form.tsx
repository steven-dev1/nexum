"use client";

import { ActionForm } from "@/components/action-form";
import { Field, inputCls } from "@/components/ui";
import { redeemInvitation, signUpWithInvite } from "@/lib/actions/invitations";

/** Crear cuenta nueva con el enlace de invitación. */
export function SignupForm({ token }: { token: string }) {
  return (
    <ActionForm action={signUpWithInvite} submitLabel="Crear mi cuenta" pendingLabel="Creando…">
      <input type="hidden" name="token" value={token} />
      <Field label="Nombre completo">
        <input name="full_name" autoComplete="name" required className={inputCls} autoFocus />
      </Field>
      <Field label="Correo">
        <input name="email" type="email" autoComplete="email" required className={inputCls} />
      </Field>
      <Field label="Contraseña" hint="Mínimo 8 caracteres.">
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputCls}
        />
      </Field>
    </ActionForm>
  );
}

/** Usar el enlace con la cuenta con la que ya iniciaste sesión. */
export function RedeemForm({ token }: { token: string }) {
  return (
    <ActionForm
      action={redeemInvitation}
      submitLabel="Usar este enlace con mi cuenta"
      pendingLabel="Activando…"
      variant="accent"
    >
      <input type="hidden" name="token" value={token} />
    </ActionForm>
  );
}
