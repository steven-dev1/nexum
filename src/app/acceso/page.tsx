import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Field, btnGhost, inputCls } from "@/components/ui";
import { redeemInvitation } from "@/lib/actions/invitations";
import { signOut } from "@/lib/actions/auth";
import { getAccountProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Activar acceso" };

export default function AccessPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <Brand className="mb-8 justify-center" />
        <Suspense
          fallback={<div className="h-72 animate-pulse rounded-xl border border-line bg-surface" aria-hidden />}
        >
          <AccessContent />
        </Suspense>
        <div aria-hidden className="mx-auto mt-6 h-1 w-16 rounded-full bg-accent" />
      </div>
    </main>
  );
}

/** Cuentas con sesión pero sin acceso al conjunto: necesitan canjear una invitación. */
async function AccessContent() {
  const profile = await getAccountProfile();
  if (profile.isMember) redirect("/");

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-ink">
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
      <h1 className="text-xl font-bold text-ink">Activa tu acceso</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Hola, {profile.fullName}. Tu cuenta existe, pero aún no está vinculada a una unidad. Pega el enlace de
        invitación que te dio la administración.
      </p>

      <ActionForm action={redeemInvitation} submitLabel="Activar acceso" pendingLabel="Activando…" variant="accent">
        <Field label="Enlace o código de invitación">
          <input name="token" required placeholder="https://…/invitacion/…" className={inputCls} autoFocus />
        </Field>
      </ActionForm>

      <form action={signOut} className="mt-4">
        <button type="submit" className={`${btnGhost} w-full`}>
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
