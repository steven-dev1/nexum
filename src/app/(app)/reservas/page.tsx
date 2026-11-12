import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Badge, Card, ContentSkeleton, Empty, PageHeader, SectionTitle, btnGhost, btnSm } from "@/components/ui";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { bogotaDateTime, fmtCop, fmtDate, fmtHours, fmtTime, todayBogota } from "@/lib/format";
import { unitOptions } from "@/lib/options";
import { createClient } from "@/lib/supabase/server";
import { cancelReservation, createReservation, updateReservation } from "./actions";
import { Availability } from "./availability";
import { amenityColumns, getBookings, toAmenityInfo, type AmenityRow } from "./data";
import { ReservationFields } from "./reservation-fields";

export const metadata: Metadata = { title: "Reservas" };

type Reservation = {
  id: string;
  user_id: string;
  amenity_id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  amenities: { name: string } | null;
  units: { tower: string; number: string } | null;
};

export default function ReservasPage() {
  return (
    <>
      <PageHeader
        title="Reserva de zonas comunes"
        description="Salón social, BBQ, cancha, gimnasio… Los horarios son en hora de Colombia."
        action={
          <Suspense fallback={null}>
            <NewReservation />
          </Suspense>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <ReservasContent />
      </Suspense>
    </>
  );
}

/** Botón + modal de reserva. El personal elige la unidad; el residente reserva para la suya. */
async function NewReservation() {
  const profile = await getProfile();
  const staff = isStaff(profile);
  if (!staff && !profile.unitId) return null;

  const supabase = await createClient();
  const [amenitiesRes, unitsRes, bookings] = await Promise.all([
    supabase.from("amenities").select(amenityColumns).eq("active", true).order("name"),
    staff
      ? supabase.from("units").select("id, tower, number").order("tower").order("number")
      : Promise.resolve({ data: [] as { id: string; tower: string; number: string }[] }),
    getBookings(supabase, { withUnits: staff }),
  ]);
  const amenities = (amenitiesRes.data ?? []) as AmenityRow[];
  if (amenities.length === 0) return null;

  return (
    <Modal
      title="Nueva reserva"
      description={staff ? "Reserva una zona común a nombre de una unidad." : `Para ${profile.unitLabel}.`}
      icon="calendar"
      trigger="Nueva reserva"
      plus
    >
      <ActionForm action={createReservation} submitLabel="Reservar" pendingLabel="Reservando…" variant="accent">
        <ReservationFields
          amenities={amenities.map(toAmenityInfo)}
          bookings={bookings}
          unitOptions={staff ? unitOptions(unitsRes.data ?? []) : undefined}
        />
      </ActionForm>
    </Modal>
  );
}

async function ReservasContent() {
  const profile = await getProfile();
  const staff = isStaff(profile);
  const supabase = await createClient();

  const [amenitiesRes, reservationsRes, bookings] = await Promise.all([
    supabase.from("amenities").select(amenityColumns).eq("active", true).order("name"),
    staff
      ? supabase
          .from("reservations")
          .select("id, user_id, amenity_id, starts_at, ends_at, notes, amenities(name), units(tower, number)")
          .eq("status", "confirmada")
          .gt("ends_at", new Date().toISOString())
          .order("starts_at")
          .limit(50)
      : Promise.resolve({ data: [] as Reservation[] }),
    getBookings(supabase, { withUnits: staff }),
  ]);

  const amenities = (amenitiesRes.data ?? []) as AmenityRow[];
  const amenityInfos = amenities.map(toAmenityInfo);
  const reservations = (reservationsRes.data ?? []) as unknown as Reservation[];
  const now = new Date().toISOString();

  return (
    <div className="space-y-6">
      {!staff && !profile.unitId && (
        <p className="rounded-xl border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          Tu usuario aún no tiene una unidad asignada. Pídele a la administración que la asigne para poder reservar.
        </p>
      )}

      <Card>
        <SectionTitle>Zonas comunes</SectionTitle>
        {amenities.length === 0 ? (
          <Empty>La administración aún no ha configurado zonas comunes.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((a) => (
              <li key={a.id} className="rounded-lg border border-line bg-surface-2 p-3">
                <p className="font-semibold text-ink">{a.name}</p>
                {a.description && <p className="mt-0.5 text-sm text-muted">{a.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="primary">{fmtHours(a.open_time, a.close_time)}</Badge>
                  <Badge>Máx. {a.max_hours} h</Badge>
                  {a.capacity && <Badge>{a.capacity} personas</Badge>}
                  {a.deposit_cop > 0 && <Badge tone="accent">Depósito {fmtCop(a.deposit_cop)}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {staff && (
        <Card>
          <SectionTitle>Próximas reservas</SectionTitle>
          {reservations.length === 0 ? (
            <Empty>No hay reservas próximas.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {reservations.map((r) => {
                const notStarted = Date.parse(r.starts_at) > Date.parse(now);
                const start = bogotaDateTime(r.starts_at);
                const end = bogotaDateTime(r.ends_at);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{r.amenities?.name}</p>
                      <p className="text-sm text-muted">
                        {fmtDate(r.starts_at)} · {fmtTime(r.starts_at)} – {fmtTime(r.ends_at)}
                      </p>
                      <p className="text-xs text-muted">
                        {unitLabel(r.units)}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {notStarted && (
                        <Modal
                          title="Editar reserva"
                          description={`${r.amenities?.name ?? "Reserva"} · ${unitLabel(r.units)}`}
                          icon="edit"
                          trigger="Editar"
                          triggerClassName={`${btnGhost} ${btnSm}`}
                        >
                          <ActionForm
                            action={updateReservation}
                            submitLabel="Guardar cambios"
                            pendingLabel="Guardando…"
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <ReservationFields
                              amenities={amenityInfos}
                              bookings={bookings}
                              excludeId={r.id}
                              defaults={{
                                amenityId: r.amenity_id,
                                date: start.date,
                                start: start.time,
                                end: end.time,
                                notes: r.notes ?? "",
                              }}
                            />
                          </ActionForm>
                        </Modal>
                      )}
                      <form action={cancelReservation}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className={`${btnGhost} ${btnSm}`}>
                          Cancelar
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {amenities.length > 0 && (
        <Card>
          <SectionTitle>Disponibilidad</SectionTitle>
          <p className="-mt-2 mb-4 text-sm text-muted">
            Elige una zona y un día para ver qué horarios ya están reservados.
          </p>
          <Availability amenities={amenityInfos} bookings={bookings} today={todayBogota()} />
        </Card>
      )}
    </div>
  );
}
