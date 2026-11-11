import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, Field, SectionTitle, btnGhost, btnSm, inputCls } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { createUnits, deleteUnit } from "./actions";

export const metadata: Metadata = { title: "Unidades" };

type UnitRow = { id: string; tower: string; number: string; profiles: { count: number }[] };

export default async function UnidadesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id, tower, number, profiles(count)")
    .order("tower")
    .order("number");

  const units = (data ?? []) as UnitRow[];
  const byTower = Map.groupBy(units, (u) => u.tower);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {units.length === 0 ? (
          <Card>
            <Empty>Aún no hay unidades. Crea las primeras con el formulario.</Empty>
          </Card>
        ) : (
          [...byTower.entries()].map(([tower, list]) => (
            <Card key={tower || "sin-torre"}>
              <SectionTitle>
                {tower ? `Torre ${tower}` : "Sin torre"} <Badge>{list.length}</Badge>
              </SectionTitle>
              <ul className="grid gap-2 sm:grid-cols-2">
                {list.map((u) => {
                  const residents = u.profiles[0]?.count ?? 0;
                  return (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">Apto {u.number}</p>
                        <p className="text-xs text-muted">
                          {residents === 0 ? "Sin usuarios" : `${residents} usuario${residents === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      {residents === 0 && (
                        <ActionForm
                          action={deleteUnit}
                          submitLabel="Eliminar"
                          pendingLabel="…"
                          className="flex flex-col items-end gap-1"
                          buttonClassName={`${btnGhost} ${btnSm}`}
                        >
                          <input type="hidden" name="id" value={u.id} />
                        </ActionForm>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-8">
        <SectionTitle>Agregar unidades</SectionTitle>
        <ActionForm action={createUnits} submitLabel="Crear" variant="accent">
          <Field label="Torre (vacío si no hay torres)">
            <input name="tower" placeholder="1" className={inputCls} />
          </Field>
          <Field label="Apartamentos">
            <textarea
              name="numbers"
              rows={3}
              required
              placeholder="101, 102, 201-210"
              className={inputCls}
            />
          </Field>
          <p className="text-xs text-muted">
            Separa con comas o espacios. Usa rangos como 101-110 para crear varias de una vez.
          </p>
        </ActionForm>
      </Card>
    </div>
  );
}
