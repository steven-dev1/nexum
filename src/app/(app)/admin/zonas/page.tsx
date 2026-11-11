import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, Field, SectionTitle, inputCls } from "@/components/ui";
import { fmtCop, hhmm } from "@/lib/format";
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
        <input name="name" required defaultValue={a?.name} placeholder="Salón social" className={inputCls} />
      </Field>
      <Field label="Descripción">
        <input name="description" defaultValue={a?.description ?? ""} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Abre">
          <input type="time" name="open_time" required defaultValue={a ? hhmm(a.open_time) : "08:00"} className={inputCls} />
        </Field>
        <Field label="Cierra">
          <input type="time" name="close_time" required defaultValue={a ? hhmm(a.close_time) : "22:00"} className={inputCls} />
        </Field>
        <Field label="Máx. horas por reserva">
          <input type="number" min={1} name="max_hours" required defaultValue={a?.max_hours ?? 4} className={inputCls} />
        </Field>
        <Field label="Aforo (personas)">
          <input type="number" min={1} name="capacity" defaultValue={a?.capacity ?? ""} className={inputCls} />
        </Field>
      </div>
      <Field label="Depósito (COP)">
        <input type="number" min={0} step={1000} name="deposit_cop" defaultValue={a?.deposit_cop ?? 0} className={inputCls} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="active" defaultChecked={a?.active ?? true} className="size-4 accent-[var(--primary)]" />
        Disponible para reservar
      </label>
    </>
  );
}

export default async function ZonasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("amenities")
    .select("id, name, description, capacity, deposit_cop, open_time, close_time, max_hours, active")
    .order("name");
  const amenities = (data ?? []) as Amenity[];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        {amenities.length === 0 ? (
          <Card>
            <Empty>Aún no hay zonas comunes. Crea la primera con el formulario.</Empty>
          </Card>
        ) : (
          amenities.map((a) => (
            <Card key={a.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{a.name}</p>
                    <p className="text-xs text-muted">
                      {hhmm(a.open_time)} – {hhmm(a.close_time)} · máx. {a.max_hours} h
                      {a.deposit_cop > 0 ? ` · depósito ${fmtCop(a.deposit_cop)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={a.active ? "success" : "neutral"}>{a.active ? "Activa" : "Inactiva"}</Badge>
                    <span className="text-sm font-semibold text-primary-ink group-open:hidden">Editar</span>
                    <span className="hidden text-sm font-semibold text-primary-ink group-open:inline">Cerrar</span>
                  </div>
                </summary>
                <div className="mt-4 border-t border-line pt-4">
                  <ActionForm action={saveAmenity} submitLabel="Guardar cambios">
                    <AmenityFields a={a} />
                  </ActionForm>
                </div>
              </details>
            </Card>
          ))
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-8">
        <SectionTitle>Nueva zona común</SectionTitle>
        <ActionForm action={saveAmenity} submitLabel="Crear zona" variant="accent">
          <AmenityFields />
        </ActionForm>
      </Card>
    </div>
  );
}
