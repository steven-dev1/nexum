import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, ContentSkeleton, Empty } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TARGETS, type TicketStatus } from "@/lib/support";
import { loadTickets } from "../../ayuda/load-tickets";
import { TicketCard } from "../../ayuda/ticket-card";

export const metadata: Metadata = { title: "Soporte" };

const STATES = [
  { key: "abiertas", label: "Pendientes", statuses: ["abierta", "en_curso"] as TicketStatus[] },
  { key: "resueltas", label: "Resueltas", statuses: ["resuelta"] as TicketStatus[] },
  { key: "todas", label: "Todas", statuses: undefined },
];

export default function SoportePage({ searchParams }: PageProps<"/admin/soporte">) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <SoporteContent searchParams={searchParams} />
    </Suspense>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function SoporteContent({ searchParams }: { searchParams: PageProps<"/admin/soporte">["searchParams"] }) {
  const params = await searchParams;
  const state = STATES.find((s) => s.key === first(params.estado)) ?? STATES[0];
  const target = TARGETS.find((t) => t.value === first(params.destino))?.value;

  const supabase = await createClient();
  const tickets = await loadTickets(supabase, { statuses: state.statuses, target, withAuthors: true });

  const href = (estado: string, destino?: string) => {
    const q = new URLSearchParams();
    if (estado !== "abiertas") q.set("estado", estado);
    if (destino) q.set("destino", destino);
    return q.size ? `/admin/soporte?${q}` : "/admin/soporte";
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
      active ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div role="group" aria-label="Estado" className="flex flex-wrap gap-1.5">
          {STATES.map((s) => (
            <Link key={s.key} href={href(s.key, target)} aria-current={state.key === s.key ? "true" : undefined} className={chip(state.key === s.key)}>
              {s.label}
            </Link>
          ))}
        </div>
        <div role="group" aria-label="Destino" className="flex flex-wrap gap-1.5">
          <Link href={href(state.key)} aria-current={!target ? "true" : undefined} className={chip(!target)}>
            Todas
          </Link>
          {TARGETS.map((t) => (
            <Link key={t.value} href={href(state.key, t.value)} aria-current={target === t.value ? "true" : undefined} className={chip(target === t.value)}>
              {t.value === "soporte_tecnico" ? "Soporte técnico" : "Administración"}
            </Link>
          ))}
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <Empty>No hay solicitudes con este filtro.</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} admin />
          ))}
        </div>
      )}
    </div>
  );
}
