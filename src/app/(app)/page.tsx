import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Next = { title: string; at: string } | null;

export default async function HomePage() {
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
  const nextReservation: Next = myReservation
    ? { title: myReservation.amenities?.name ?? "Reserva", at: myReservation.starts_at }
    : null;
  const nextAssembly: Next = assemblyRes.data?.[0]
    ? { title: assemblyRes.data[0].title, at: assemblyRes.data[0].scheduled_at }
    : null;
  const readIds = new Set((readsRes.data ?? []).map((r) => r.announcement_id as string));
  const unread = (announcementsRes.data ?? []).filter((a) => !readIds.has(a.id as string)).length;

  const firstName = profile.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hola, ${firstName}`}
        description={profile.unitLabel ?? (isStaff(profile) ? "Panel de operación" : unitLabel(null))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/paqueteria" className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <p className="text-sm font-medium text-muted">Paquetería</p>
            <p className="mt-1 text-4xl font-extrabold text-ink">{pendingPackages}</p>
            <p className="mt-1 text-sm text-muted">
              {isStaff(profile) ? "paquetes por entregar" : "paquetes esperándote en portería"}
            </p>
          </Card>
        </Link>

        <Link href="/comunicados" className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <p className="text-sm font-medium text-muted">Comunicados</p>
            <p className="mt-1 flex items-center gap-2 text-4xl font-extrabold text-ink">
              {unread}
              {unread > 0 && <Badge tone="accent">Nuevos</Badge>}
            </p>
            <p className="mt-1 text-sm text-muted">sin leer</p>
          </Card>
        </Link>

        <Link href="/reservas" className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <p className="text-sm font-medium text-muted">Tu próxima reserva</p>
            {nextReservation ? (
              <>
                <p className="mt-1 text-lg font-bold text-ink">{nextReservation.title}</p>
                <p className="text-sm text-primary-ink">{fmtDateTime(nextReservation.at)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">No tienes reservas próximas. Reserva una zona común.</p>
            )}
          </Card>
        </Link>

        <Link href="/asambleas" className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <p className="text-sm font-medium text-muted">Próxima asamblea</p>
            {nextAssembly ? (
              <>
                <p className="mt-1 text-lg font-bold text-ink">{nextAssembly.title}</p>
                <p className="text-sm text-primary-ink">{fmtDateTime(nextAssembly.at)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">No hay asambleas convocadas.</p>
            )}
          </Card>
        </Link>
      </div>
    </>
  );
}
