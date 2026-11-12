import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { inviteReason } from "@/lib/invitation-options";
import { createClient } from "@/lib/supabase/server";
import { RedeemForm, SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Invitación", robots: { index: false, follow: false } };

export default function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <Brand className="mb-8 justify-center" />
        <Suspense
          fallback={<div className="h-72 animate-pulse rounded-xl border border-line bg-surface" aria-hidden />}
        >
          <InvitationContent params={params} />
        </Suspense>
        <div aria-hidden className="mx-auto mt-6 h-1 w-16 rounded-full bg-accent" />
      </div>
    </main>
  );
}

async function InvitationContent({ params }: { params: PageProps<"/invitacion/[token]">["params"] }) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: info }, { data: claims }] = await Promise.all([
    supabase.rpc("invitation_info", { p_token: token }),
    supabase.auth.getClaims(),
  ]);
  const invite = info?.[0];
  const signedInAs = (claims?.claims?.email as string | undefined) ?? null;

  if (!invite?.valid) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
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
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
        </span>
        <h1 className="text-lg font-bold text-ink">Este enlace no se puede usar</h1>
        <p className="mt-1.5 text-sm text-muted">{inviteReason(invite?.reason)}</p>
        <Link
          href="/login"
          className="mt-5 inline-block text-sm font-semibold text-primary-ink underline-offset-2 hover:underline"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-bold text-ink">Te invitaron a Nexum</h1>
      <p className="mb-1 mt-1 text-sm text-muted">
        {invite.role === "porteria"
          ? "Acceso para el personal de portería."
          : "Servicios para residentes de tu conjunto."}
      </p>
      <div className="mb-5 mt-3 flex flex-wrap items-center gap-2">
        {invite.unit_label && <Badge tone="primary">{invite.unit_label}</Badge>}
        {invite.expires_at && <span className="text-xs text-muted">Vence {fmtDateTime(invite.expires_at)}</span>}
      </div>

      {signedInAs ? (
        <>
          <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-ink">
            Iniciaste sesión como <b>{signedInAs}</b>. ¿Quieres usar este enlace con esa cuenta?
          </p>
          <RedeemForm token={token} />
        </>
      ) : (
        <>
          <SignupForm token={token} />
          <p className="mt-4 text-center text-sm text-muted">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-semibold text-primary-ink underline-offset-2 hover:underline">
              Inicia sesión
            </Link>{" "}
            y abre este enlace de nuevo.
          </p>
        </>
      )}
    </div>
  );
}
