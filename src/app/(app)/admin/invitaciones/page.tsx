import type { Metadata } from "next";
import { Suspense } from "react";
import { Modal } from "@/components/modal";
import { Badge, Card, ContentSkeleton, Empty, SectionTitle, btnGhost, btnSm } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { unitOptions } from "@/lib/options";
import { createClient } from "@/lib/supabase/server";
import { unitFullLabel } from "@/lib/units";
import { revokeInvitation } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Invitaciones" };

type InvitationRow = {
  id: string;
  role: "residente" | "porteria";
  label: string | null;
  expires_at: string;
  max_uses: number;
  uses: number;
  revoked_at: string | null;
  created_at: string;
  units: { tower: string; number: string } | null;
  invitation_redemptions: { redeemed_at: string; profiles: { full_name: string; email: string | null } | null }[];
};

export default function InvitacionesPage({ searchParams }: PageProps<"/admin/invitaciones">) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          Nadie entra al conjunto sin invitación. Genera un enlace por unidad, elige cuánto tiempo vale y envíalo por
          WhatsApp.
        </p>
        <Suspense fallback={null}>
          <NewInvitation searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<ContentSkeleton />}>
        <InvitationsList />
      </Suspense>
    </>
  );
}

/** Botón + modal. Si se llega desde una unidad (?unidad=…), se abre con esa unidad elegida. */
async function NewInvitation({ searchParams }: { searchParams: PageProps<"/admin/invitaciones">["searchParams"] }) {
  const params = await searchParams;
  const unitParam = typeof params.unidad === "string" ? params.unidad : undefined;

  const supabase = await createClient();
  const { data } = await supabase.from("units").select("id, tower, number, floor").order("tower").order("number");
  const units = data ?? [];

  return (
    <Modal
      title="Nueva invitación"
      description="Crea un enlace de un solo uso o para varias personas de la misma unidad."
      icon="users"
      trigger="Nueva invitación"
      plus
      defaultOpen={!!unitParam && units.some((u) => u.id === unitParam)}
    >
      <InviteForm unitOptions={unitOptions(units)} defaultUnit={unitParam} />
    </Modal>
  );
}

function statusOf(i: InvitationRow, now: number) {
  if (i.revoked_at) return { key: "revocada", label: "Cancelada", tone: "neutral" as const, active: false };
  if (Date.parse(i.expires_at) <= now)
    return { key: "vencida", label: "Vencida", tone: "danger" as const, active: false };
  if (i.uses >= i.max_uses) return { key: "agotada", label: "Usada", tone: "success" as const, active: false };
  return { key: "activa", label: "Activa", tone: "primary" as const, active: true };
}

/** «en 2 días», «en 3 h», «en 20 min» (para enlaces activos). */
function timeLeft(iso: string, now: number) {
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60_000));
  if (mins < 60) return `${Math.max(mins, 1)} min`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} días`;
}

async function InvitationsList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select(
      "id, role, label, expires_at, max_uses, uses, revoked_at, created_at, units(tower, number), invitation_redemptions(redeemed_at, profiles(full_name, email))",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as InvitationRow[];
  const now = new Date().getTime();
  const active = rows.filter((r) => statusOf(r, now).active);
  const history = rows.filter((r) => !statusOf(r, now).active);

  if (rows.length === 0) {
    return (
      <Card>
        <Empty>Aún no has creado invitaciones. Toca «Nueva invitación» para generar la primera.</Empty>
      </Card>
    );
  }

  const row = (i: InvitationRow) => {
    const status = statusOf(i, now);
    const who = i.invitation_redemptions.map((r) => r.profiles?.full_name || r.profiles?.email || "Sin nombre");
    return (
      <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
            {i.role === "porteria" ? "Portería" : unitFullLabel(i.units)}
            <Badge tone={status.tone}>{status.label}</Badge>
            {i.role === "porteria" && <Badge tone="accent">Personal</Badge>}
          </p>
          {i.label && <p className="text-sm text-muted">{i.label}</p>}
          <p className="mt-0.5 text-xs text-muted">
            {status.active
              ? `Vence en ${timeLeft(i.expires_at, now)} · ${fmtDateTime(i.expires_at)}`
              : `Venció ${fmtDateTime(i.expires_at)}`}
            {" · "}
            {i.uses} de {i.max_uses} {i.max_uses === 1 ? "uso" : "usos"}
          </p>
          {who.length > 0 && <p className="mt-0.5 text-xs text-muted">Canjeada por: {who.join(", ")}</p>}
        </div>
        {status.active && (
          <form action={revokeInvitation}>
            <input type="hidden" name="id" value={i.id} />
            <button type="submit" className={`${btnGhost} ${btnSm}`}>
              Cancelar enlace
            </button>
          </form>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          Activas <Badge tone="primary">{active.length}</Badge>
        </SectionTitle>
        {active.length === 0 ? (
          <Empty>No hay enlaces activos.</Empty>
        ) : (
          <ul className="divide-y divide-line">{active.map(row)}</ul>
        )}
      </Card>

      {history.length > 0 && (
        <Card>
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-ink">
              <span>
                Historial <Badge>{history.length}</Badge>
              </span>
              <span className="text-sm font-medium text-primary-ink">Ver</span>
            </summary>
            <ul className="mt-3 divide-y divide-line">{history.map(row)}</ul>
          </details>
        </Card>
      )}
    </div>
  );
}
