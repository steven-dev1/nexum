import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { TimePicker } from "@/components/time-picker";
import { Badge, Card, ContentSkeleton, Empty, Field, btnGhost, btnSm, inputCls, labelCls } from "@/components/ui";
import { fmtCop, fmtHours, hhmm } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { saveAmenity } from "./actions";

export const metadata: Metadata = { title: "Zonas comunes" };

type Amenity = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  deposit_cop: number;
  open_time: string;
  close_time: string;
  max_hours: number;
  active: boolean;
};

function AmenityFields({ a }: { a?: Amenity }) {
  return (
    <>
      {a && <input type="hidden" name="id" value={a.id} />}
      <Field label="Nombre">
        <input name="name" required defaultValue={a?.name} placeholder="Salón social" className={inputCls} autoFocus />
      </Field>
      <Field label="Descripción">
        <input name="description" defaultValue={a?.description ?? ""} placeholder="Qué incluye, reglas básicas…" className={inputCls} />
      </Field>

      <fieldset className="rounded-2xl border border-line bg-surface-2/50 p-4">
        <legend className="px-1.5 text-[13px] font-semibold text-ink">Horario de uso</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className={labelCls}>Abre</span>
            <TimePicker name="open_time" required defaultValue={a ? hhmm(a.open_time) : "08:00"} />
          </div>
          <div>
            <span className={labelCls}>Cierra</span>
            <TimePicker name="close_time" required defaultValue={a ? hhmm(a.close_time) : "22:00"} />
          </div>
        </div>
        <p className="mt-3 flex gap-2 text-xs leading-5 text-muted">
          <svg className="mt-0.5 size-4 shrink-0 text-primary-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
          Si cierra a una hora menor que la de apertura (ej. abre 6:00 p. m. y cierra 2:00 a. m.), se entiende que cierra al día siguiente.
        </p>
      </fieldset>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Máx. horas por reserva">
          <input type="number" min={1} name="max_hours" required defaultValue={a?.max_hours ?? 4} className={inputCls} />
        </Field>
        <Field label="Aforo (personas)">
          <input type="number" min={1} name="capacity" defaultValue={a?.capacity ?? ""} className={inputCls} />
        </Field>
        <Field label="Depósito (COP)" className="col-span-2 sm:col-span-1">
          <input type="number" min={0} step={1000} name="deposit_cop" defaultValue={a?.deposit_cop ?? 0} className={inputCls} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="active" defaultChecked={a?.active ?? true} className="size-4 accent-[var(--primary)]" />
        Disponible para reservar
      </label>
    </>
  );
}

export default function ZonasPage() {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Espacios que los residentes pueden reservar.</p>
        <Modal
          title="Nueva zona común"
          description="Define su horario y las reglas para reservarla."
          icon="trees"
          trigger="Nueva zona"
          plus
          size="lg"
        >
          <ActionForm action={saveAmenity} submitLabel="Crear zona" pendingLabel="Creando…" variant="accent">
            <AmenityFields />
          </ActionForm>
        </Modal>
      </div>
      <Suspense fallback={<ContentSkeleton />}>
        <ZonasContent />
      </Suspense>
    </>
  );
}

async function ZonasContent() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("amenities")
    .select("id, name, description, capacity, deposit_cop, open_time, close_time, max_hours, active")
    .order("name");
  const amenities = (data ?? []) as Amenity[];

  if (amenities.length === 0) {
    return (
      <Card>
        <Empty>Aún no hay zonas comunes. Crea la primera con «Nueva zona».</Empty>
      </Card>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {amenities.map((a) => (
        <li key={a.id}>
          <Card className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-ink">{a.name}</p>
              <Badge tone={a.active ? "success" : "neutral"}>{a.active ? "Activa" : "Inactiva"}</Badge>
            </div>
            {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="primary">{fmtHours(a.open_time, a.close_time)}</Badge>
              <Badge>Máx. {a.max_hours} h</Badge>
              {a.capacity && <Badge>{a.capacity} personas</Badge>}
              {a.deposit_cop > 0 && <Badge tone="accent">Depósito {fmtCop(a.deposit_cop)}</Badge>}
            </div>
            <div className="mt-auto flex justify-end pt-4">
              <Modal
                title={`Editar ${a.name}`}
                description="Los cambios aplican a las reservas nuevas."
                icon="edit"
                trigger="Editar"
                triggerClassName={`${btnGhost} ${btnSm}`}
                size="lg"
              >
                <ActionForm action={saveAmenity} submitLabel="Guardar cambios">
                  <AmenityFields a={a} />
                </ActionForm>
              </Modal>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
