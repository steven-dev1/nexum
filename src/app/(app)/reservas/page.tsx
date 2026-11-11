import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { DatePicker } from "@/components/date-picker";
import { Modal } from "@/components/modal";
import { TimePicker } from "@/components/time-picker";
import {
  Badge,
  Card,
  ContentSkeleton,
  Empty,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  btnGhost,
  btnSm,
  inputCls,
  labelCls,
} from "@/components/ui";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { fmtCop, fmtDate, fmtHours, fmtTime, todayBogota } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cancelReservation, createReservation } from "./actions";

export const metadata: Metadata = { title: "Reservas" };

type Amenity = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  deposit_cop: number;
  open_time: string;
  close_time: string;
  max_hours: number;
};

type Reservation = {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  amenities: { name: string } | null;
  units: { tower: string; number: string } | null;
};

const amenityColumns = "id, name, description, capacity, deposit_cop, open_time, close_time, max_hours";

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
  const [amenitiesRes, unitsRes] = await Promise.all([
    supabase.from("amenities").select(amenityColumns).eq("active", true).order("name"),
    staff
      ? supabase.from("units").select("id, tower, number").order("tower").order("number")
      : Promise.resolve({ data: [] as { id: string; tower: string; number: string }[] }),
  ]);
  const amenities = (amenitiesRes.data ?? []) as Amenity[];
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
        {staff && (
          <Field label="Unidad">
            <Select name="unit_id" required defaultValue="">
              <option value="" disabled>
                Selecciona la unidad…
              </option>
              {(unitsRes.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {unitLabel(u)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Zona común">
          <Select name="amenity_id" required defaultValue="" autoFocus={!staff}>
            <option value="" disabled>
              Selecciona la zona…
            </option>
            {amenities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {fmtHours(a.open_time, a.close_time)}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <span className={labelCls}>Fecha</span>
          <DatePicker name="date" min={todayBogota()} required />
        </div>
        <div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={labelCls}>Desde</span>
              <TimePicker name="start" required />
            </div>
            <div>
              <span className={labelCls}>Hasta</span>
              <TimePicker name="end" required />
            </div>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted">
            Si la hora de fin es menor que la de inicio, la reserva termina al día siguiente.
          </p>
        </div>
        <Field label="Notas (opcional)">
          <input name="notes" placeholder="Cumpleaños, reunión…" className={inputCls} />
        </Field>
      </ActionForm>
    </Modal>
  );
}

async function ReservasContent() {
  const profile = await getProfile();
  const staff = isStaff(profile);
  const supabase = await createClient();

  const [amenitiesRes, reservationsRes] = await Promise.all([
    supabase.from("amenities").select(amenityColumns).eq("active", true).order("name"),
    supabase
      .from("reservations")
      .select("id, user_id, starts_at, ends_at, notes, amenities(name), units(tower, number)")
      .eq("status", "confirmada")
      .gt("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(50),
  ]);

  const amenities = (amenitiesRes.data ?? []) as Amenity[];
  const reservations = (reservationsRes.data ?? []) as unknown as Reservation[];

  return (
    <div className="space-y-6">
      {!staff && !profile.unitId && (
        <p className="rounded-xl border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          Tu usuario aún no tiene una unidad asignada. Pídele a la administración que la asigne para poder reservar.
        </p>
      )}

      <Card>
        <SectionTitle>Zonas disponibles</SectionTitle>
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

      <Card>
        <SectionTitle>Próximas reservas</SectionTitle>
        {reservations.length === 0 ? (
          <Empty>No hay reservas próximas.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {reservations.map((r) => {
              const mine = !staff && r.user_id === profile.id;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {r.amenities?.name} {mine && <Badge tone="accent">Tuya</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {fmtDate(r.starts_at)} · {fmtTime(r.starts_at)} – {fmtTime(r.ends_at)}
                    </p>
                    <p className="text-xs text-muted">
                      {unitLabel(r.units)}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  {(mine || staff) && (
                    <form action={cancelReservation}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={`${btnGhost} ${btnSm}`}>
                        Cancelar
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
