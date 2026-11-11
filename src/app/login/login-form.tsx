"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, inputCls } from "@/components/ui";
import { signIn, signUp } from "@/lib/actions/auth";

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");

  return (
    <div>
      {mode === "in" ? (
        <ActionForm key="in" action={signIn} submitLabel="Ingresar" pendingLabel="Ingresando…">
          <Field label="Correo">
            <input name="email" type="email" autoComplete="email" required className={inputCls} />
          </Field>
          <Field label="Contraseña">
            <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
          </Field>
        </ActionForm>
      ) : (
        <ActionForm key="up" action={signUp} submitLabel="Crear cuenta" pendingLabel="Creando…">
          <Field label="Nombre completo">
            <input name="full_name" autoComplete="name" required className={inputCls} />
          </Field>
          <Field label="Correo">
            <input name="email" type="email" autoComplete="email" required className={inputCls} />
          </Field>
          <Field label="Contraseña (mínimo 8 caracteres)">
            <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
          </Field>
        </ActionForm>
      )}

      <p className="mt-4 text-center text-sm text-muted">
        {mode === "in" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="font-semibold text-primary-ink underline-offset-2 hover:underline"
        >
          {mode === "in" ? "Regístrate" : "Ingresa"}
        </button>
      </p>
    </div>
  );
}
