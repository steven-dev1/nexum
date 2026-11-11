import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { InstallPrompt } from "@/components/install-prompt";
import { Badge, Card, ContentSkeleton, PageHeader } from "@/components/ui";
import { getProfile, isAdmin, isStaff, roleLabel, unitLabel } from "@/lib/auth";
import { bogotaToIso, fmtDateTime, todayBogota } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Inicio" description="Resumen de tu conjunto." />
      <Suspense fallback={<ContentSkeleton />}>
        <HomeContent />
      </Suspense>
    </>
  );
}

function Tile({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-primary">
        <p className="text-sm font-medium text-muted">{label}</p>
        {children}
      </Card>
    </Link>
  );
}

const Big = ({ children }: { children: ReactNode }) => (
  <p className="mt-1 flex items-center gap-2 text-4xl font-extrabold text-ink">{children}</p>
);

async function HomeContent() {
  const profile = await getProfile();
  const firstName = profile.fullName.split(" ")[0];

  return (
    <>
      <InstallPrompt />
      <p className="mb-4 text-lg font-semibold text-ink">
        Hola, {firstName}{" "}
        <span className="font-normal text-muted">
          · {isStaff(profile) ? roleLabel[profile.role] : (profile.unitLabel ?? unitLabel(null))}
        </span>
      </p>
      {isStaff(profile) ? <StaffHome /> : <ResidentHome />}
    </>
  );
}

/** Panel del personal (administración y portería): operación del conjunto, sin unidad propia. */
async function StaffHome() {
  const profile = await getProfile();
  const admin = isAdmin(profile);
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const todayStartIso = bogotaToIso(todayBogota(), "00:00");

  const [pendingRes, todayRes, reservationsRes, nextReservationRes, assemblyRes, announcementsRes, readsRes, noUnitRes] =
    await Promise.all([
      supabase.from("packages").select("id", { count: "exact", head: true }).eq("status", "recibido"),
      supabase.from("packages").select("id", { count: "exact", head: true }).gte("received_at", todayStartIso),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmada")
        .gt("ends_at", nowIso),
      supabase
        .from("reservations")
        .select("starts_at, amenities(name), units(tower, number)")
        .eq("status", "confirmada")
        .gt("ends_at", nowIso)
        .order("starts_at")
        .limit(1),
      supabase
        .from("assemblies")
        .select("title, scheduled_at")
        .eq("status", "programada")
        .gt("scheduled_at", nowIso)
        .order("scheduled_at")
        .limit(1),
      supabase.from("announcements").select("id", { count: admin ? "exact" : undefined }).limit(100),
      admin
        ? Promise.resolve({ data: [] as { announcement_id: string }[] })
        : supabase.from("announcement_reads").select("announcement_id").eq("user_id", profile.id),
      admin
        ? supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "residente")
            .is("unit_id", null)
        : Promise.resolve({ count: 0 }),
    ]);

  const nextReservation = nextReservationRes.data?.[0] as unknown as
    | { starts_at: string; amenities: { name: string } | null; units: { tower: string; number: string } | null }
    | undefined;
  const nextAssembly = assemblyRes.data?.[0];
  const readIds = new Set((readsRes.data ?? []).map((r) => r.announcement_id));
  const unread = (announcementsRes.data ?? []).filter((a) => !readIds.has(a.id as string)).length;
  const noUnit = noUnitRes.count ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Tile href="/paqueteria" label="Paquetes por entregar">
        <Big>
          {pendingRes.count ?? 0}
          {(pendingRes.count ?? 0) > 0 && <Badge tone="accent">En portería</Badge>}
        </Big>
        <p className="mt-1 text-sm text-muted">{todayRes.count ?? 0} recibidos hoy</p>
      </Tile>

      <Tile href="/reservas" label="Reservas próximas">
        <Big>{reservationsRes.count ?? 0}</Big>
        <p className="mt-1 text-sm text-muted">
          {nextReservation
            ? `La siguiente: ${nextReservation.amenities?.name} · ${unitLabel(nextReservation.units)} · ${fmtDateTime(nextReservation.starts_at)}`
            : "No hay reservas próximas."}
        </p>
      </Tile>

      <Tile href="/asambleas" label="Próxima asamblea">
        {nextAssembly ? (
          <>
            <p className="mt-1 text-lg font-bold text-ink">{nextAssembly.title}</p>
            <p className="text-sm text-primary-ink">{fmtDateTime(nextAssembly.scheduled_at)}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">No hay asambleas convocadas.</p>
        )}
      </Tile>

      <Tile href="/comunicados" label="Comunicados">
        {admin ? (
          <>
            <Big>{announcementsRes.count ?? 0}</Big>
            <p className="mt-1 text-sm text-muted">publicados · revisa quién los leyó</p>
          </>
        ) : (
          <>
            <Big>
              {unread}
              {unread > 0 && <Badge tone="accent">Nuevos</Badge>}
            </Big>
            <p className="mt-1 text-sm text-muted">sin leer</p>
          </>
        )}
      </Tile>

      {admin && (
        <Tile href="/admin/usuarios" label="Residentes sin unidad">
          <Big>
            {noUnit}
            {noUnit > 0 && <Badge tone="danger">Por asignar</Badge>}
          </Big>
          <p className="mt-1 text-sm text-muted">Asígnales unidad para que puedan reservar y recibir paquetes.</p>
        </Tile>
      )}
    </div>
  );
}

/** Panel del residente: lo de su unidad. */
async function ResidentHome() {
  const profile = await getProfile();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [packagesRes, reservationRes, assemblyRes, announcementsRes, readsRes] = await Promise.all([
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("status", "recibido"),
    supabase
      .from("reservations")
      .select("starts_at, amenities(name)")
      .eq("status", "confirmada")
      .eq("user_id", profile.id)
      .gt("ends_at", nowIso)
      .order("starts_at")
      .limit(1),
    supabase
      .from("assemblies")
      .select("title, scheduled_at")
      .eq("status", "programada")
      .gt("scheduled_at", nowIso)
      .order("scheduled_at")
      .limit(1),
    supabase.from("announcements").select("id").order("published_at", { ascending: false }).limit(100),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", profile.id),
  ]);

  const pendingPackages = packagesRes.count ?? 0;
  const myReservation = reservationRes.data?.[0] as unknown as
    | { starts_at: string; amenities: { name: string } | null }
    | undefined;
  const nextAssembly = assemblyRes.data?.[0];
  const readIds = new Set((readsRes.data ?? []).map((r) => r.announcement_id as string));
  const unread = (announcementsRes.data ?? []).filter((a) => !readIds.has(a.id as string)).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Tile href="/paqueteria" label="Paquetería">
        <Big>
          {pendingPackages}
          {pendingPackages > 0 && <Badge tone="accent">Por recoger</Badge>}
        </Big>
        <p className="mt-1 text-sm text-muted">paquetes esperándote en portería</p>
      </Tile>

      <Tile href="/comunicados" label="Comunicados">
        <Big>
          {unread}
          {unread > 0 && <Badge tone="accent">Nuevos</Badge>}
        </Big>
        <p className="mt-1 text-sm text-muted">sin leer</p>
      </Tile>

      <Tile href="/reservas" label="Tu próxima reserva">
        {myReservation ? (
          <>
            <p className="mt-1 text-lg font-bold text-ink">{myReservation.amenities?.name ?? "Reserva"}</p>
            <p className="text-sm text-primary-ink">{fmtDateTime(myReservation.starts_at)}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">No tienes reservas próximas. Reserva una zona común.</p>
        )}
      </Tile>

      <Tile href="/asambleas" label="Próxima asamblea">
        {nextAssembly ? (
          <>
            <p className="mt-1 text-lg font-bold text-ink">{nextAssembly.title}</p>
            <p className="text-sm text-primary-ink">{fmtDateTime(nextAssembly.scheduled_at)}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">No hay asambleas convocadas.</p>
        )}
      </Tile>
    </div>
  );
}
