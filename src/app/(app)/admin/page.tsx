import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Badge, Card, ContentSkeleton, Empty, SectionTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { barHeight, parseSummary, percent, shortDay, type DayPoint } from "@/lib/summary";

export const metadata: Metadata = { title: "Resumen" };

export default function ResumenPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ResumenContent searchParams={searchParams} />
    </Suspense>
  );
}

function Tile({ href, label, value, hint, tone }: { href: string; label: string; value: ReactNode; hint?: string; tone?: "warn" | "ok" }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-primary/60"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-3xl font-bold tracking-tight text-ink">
        {value}
        {tone === "warn" && <span className="size-2 rounded-full bg-accent" aria-hidden />}
        {tone === "ok" && <span className="size-2 rounded-full bg-success" aria-hidden />}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Link>
  );
}

/** Barras por día: una serie sola, con el valor encima y la fecha debajo (la tabla accesible va en `sr-only`). */
function Bars({ title, points, pick, color }: { title: string; points: DayPoint[]; pick: (p: DayPoint) => number; color: string }) {
  const values = points.map(pick);
  const max = Math.max(0, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  // Con muchos días solo se rotulan algunos para que no se encimen.
  const step = points.length > 14 ? Math.ceil(points.length / 7) : 1;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>{title}</SectionTitle>
        <p className="text-sm text-muted">{total} en total</p>
      </div>
      {max === 0 ? (
        <Empty>Sin datos en este período.</Empty>
      ) : (
        <>
          <div className="flex h-36 items-end gap-1" role="img" aria-label={`${title}: ${points.map((p) => `${shortDay(p.day)} ${pick(p)}`).join(", ")}`}>
            {points.map((p) => {
              const v = pick(p);
              return (
                <div key={p.day} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                  <span className="mb-0.5 text-center text-[10px] font-semibold text-muted">{v > 0 && points.length <= 14 ? v : ""}</span>
                  <div className="w-full rounded-t-md" style={{ height: `${barHeight(v, max)}%`, background: color }} title={`${shortDay(p.day)}: ${v}`} />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1" aria-hidden>
            {points.map((p, i) => (
              <span key={p.day} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted">
                {i % step === 0 ? shortDay(p.day) : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

async function ResumenContent({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const params = await searchParams;
  const raw = Array.isArray(params.dias) ? params.dias[0] : params.dias;
  const days = raw === "30" ? 30 : 7;

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_summary", { p_days: days });
  const s = parseSummary(data);

  if (!s) {
    return (
      <Card>
        <Empty>No se pudo cargar el resumen.</Empty>
      </Card>
    );
  }

  const review: { label: string; value: number; href: string }[] = [
    { label: "Residentes sin unidad asignada", value: s.users.withoutUnit, href: "/admin/usuarios?rol=sin-unidad" },
    { label: "Comunicados programados", value: s.announcements.scheduled, href: "/comunicados" },
    { label: "Comunicados en borrador", value: s.announcements.drafts, href: "/comunicados" },
    { label: "Accesos de vehículos rechazados en el período", value: s.access.denied, href: "/accesos" },
  ].filter((r) => r.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {s.users.residents} residentes en {s.users.unitsWithResidents} de {s.users.units} unidades.
        </p>
        <div role="group" aria-label="Período" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {([7, 30] as const).map((d) => (
            <Link
              key={d}
              href={d === 7 ? "/admin" : "/admin?dias=30"}
              aria-current={days === d ? "true" : undefined}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                days === d ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
              }`}
            >
              {d} días
            </Link>
          ))}
        </div>
      </div>

      <section aria-label="Ahora" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile href="/paqueteria" label="Paquetes por entregar" value={s.packages.pending} tone={s.packages.pending > 0 ? "warn" : "ok"} />
        <Tile href="/reservas" label="Reservas hoy" value={s.reservations.today} hint={`${s.reservations.upcoming} próximas`} />
        <Tile href="/accesos" label="Vehículos dentro" value={s.access.vehiclesInside} hint={`${s.access.movementsToday} movimientos hoy`} />
        <Tile href="/accesos?tab=visitantes" label="Visitantes dentro" value={s.visits.inside} hint={`${s.visits.authorized} autorizados por llegar`} />
        <Tile
          href="/accesos?tab=visitantes"
          label="Esperando al residente"
          value={s.visits.waiting}
          tone={s.visits.waiting > 0 ? "warn" : undefined}
          hint="Visitas que portería pidió autorizar"
        />
      </section>

      <section aria-label={`Últimos ${days} días`} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile href="/paqueteria" label={`Paquetes recibidos (${days} d)`} value={s.packages.received} hint={`${s.packages.delivered} entregados`} />
        <Tile href="/comunicados" label={`Comunicados (${days} d)`} value={s.announcements.published} hint={`Lectura media ${Math.round(s.announcements.readRate * 100)}%`} />
        <Tile href="/accesos?tab=visitantes" label={`Visitas (${days} d)`} value={s.visits.period} />
        <Tile href="/admin/invitaciones" label="Invitaciones vigentes" value={s.users.activeInvitations} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bars title="Paquetes recibidos por día" points={s.series} pick={(p) => p.packages} color="var(--primary)" />
        <Bars title="Ingresos de vehículos por día" points={s.series} pick={(p) => p.access} color="var(--accent)" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Votaciones abiertas</SectionTitle>
          {s.polls.length === 0 ? (
            <Empty>No hay votaciones abiertas.</Empty>
          ) : (
            <ul className="space-y-4">
              {s.polls.map((p) => {
                const pct = percent(p.voted, p.total);
                return (
                  <li key={p.id}>
                    <div className="flex items-start justify-between gap-3">
                      <Link href="/asambleas" className="min-w-0 font-medium text-ink hover:text-primary-ink">
                        {p.question}
                      </Link>
                      <span className="shrink-0 text-sm font-semibold text-primary-ink">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {p.voted} de {p.total} unidades
                      {p.closes_at ? ` · cierra ${fmtDateTime(p.closes_at)}` : " · sin hora de cierre"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Para revisar</SectionTitle>
          {review.length === 0 ? (
            <Empty>Todo en orden: no hay pendientes.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {review.map((r) => (
                <li key={r.label}>
                  <Link href={r.href} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary-ink">
                    <span className="text-ink">{r.label}</span>
                    <Badge tone="accent">{r.value}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
