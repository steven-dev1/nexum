import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import {
  Badge,
  Card,
  Empty,
  Field,
  PageHeader,
  SectionTitle,
  btnGhost,
  btnSm,
  inputCls,
} from "@/components/ui";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { fmtCop, fmtDate, fmtTime, hhmm, todayBogota } from "@/lib/format";
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

export default async function ReservasPage() {
  const profile = await getProfile();
  const staff = isStaff(profile);
  const supabase = await createClient();

  const [amenitiesRes, reservationsRes] = await Promise.all([
    supabase
      .from("amenities")
      .select("id, name, description, capacity, deposit_cop, open_time, close_time, max_hours")
      .eq("active", true)
      .order("name"),
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
    <>
      <PageHeader
        title="Reserva de zonas comunes"
        description="Reserva el salón social, la zona BBQ, la cancha o el gimnasio. Los horarios son en hora de Colombia."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <SectionTitle>Zonas disponibles</SectionTitle>
            {amenities.length === 0 ? (
              <Empty>La administración aún no ha configurado zonas comunes.</Empty>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {amenities.map((a) => (
                  <li key={a.id} className="rounded-lg border border-line bg-surface-2 p-3">
                    <p className="font-semibold text-ink">{a.name}</p>
                    {a.description && <p className="mt-0.5 text-sm text-muted">{a.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="primary">
                        {hhmm(a.open_time)} – {hhmm(a.close_time)}
                      </Badge>
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
                  const mine = r.user_id === profile.id;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          {r.amenities?.name}{" "}
                          {mine && <Badge tone="accent">Tuya</Badge>}
                        </p>
                        <p className="text-sm text-muted">
                          {fmtDate(r.starts_at)} · {fmtTime(r.starts_at)} – {fmtTime(r.ends_at)}
                        </p>
                        <p className="text-xs text-muted">{unitLabel(r.units)}</p>
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

        <Card className="h-fit lg:sticky lg:top-8">
          <SectionTitle>Nueva reserva</SectionTitle>
          {!profile.unitId ? (
            <Empty>Tu usuario aún no tiene una unidad asignada.</Empty>
          ) : (
            <ActionForm action={createReservation} submitLabel="Reservar" variant="accent">
              <Field label="Zona">
                <select name="amenity_id" required defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {amenities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha">
                <input type="date" name="date" min={todayBogota()} required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desde">
                  <input type="time" name="start" required className={inputCls} />
                </Field>
                <Field label="Hasta">
                  <input type="time" name="end" required className={inputCls} />
                </Field>
              </div>
              <Field label="Notas (opcional)">
                <input name="notes" placeholder="Cumpleaños, reunión…" className={inputCls} />
              </Field>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
