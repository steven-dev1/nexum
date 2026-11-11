import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import {
  Badge,
  Card,
  ContentSkeleton,
  Empty,
  Field,
  SectionTitle,
  btnGhost,
  btnSm,
  inputCls,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { createUnits, deleteUnit } from "./actions";

export const metadata: Metadata = { title: "Unidades" };

type UnitRow = { id: string; tower: string; number: string; profiles: { count: number }[] };

export default function UnidadesPage() {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Torres y apartamentos del conjunto.</p>
        <Modal
          title="Agregar unidades"
          description="Crea uno o varios apartamentos de una torre a la vez."
          icon="building"
          trigger="Agregar unidades"
          plus
        >
          <ActionForm action={createUnits} submitLabel="Crear unidades" pendingLabel="Creando…" variant="accent">
            <Field label="Torre" hint="Déjala vacía si el conjunto no tiene torres.">
              <input name="tower" placeholder="1, A, Norte…" className={inputCls} autoFocus />
            </Field>
            <Field
              label="Apartamentos"
              hint={
                <>
                  Separa con comas o espacios. Un rango como <span className="font-mono text-ink">101-110</span> crea los
                  diez de una vez; los que ya existan se omiten.
                </>
              }
            >
              <textarea name="numbers" rows={3} required placeholder="101, 102, 201-210" className={inputCls} />
            </Field>
          </ActionForm>
        </Modal>
      </div>
      <Suspense fallback={<ContentSkeleton />}>
        <UnidadesContent />
      </Suspense>
    </>
  );
}

async function UnidadesContent() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id, tower, number, profiles(count)")
    .order("tower")
    .order("number");

  const units = (data ?? []) as UnitRow[];
  const byTower = Map.groupBy(units, (u) => u.tower);

  if (units.length === 0) {
    return (
      <Card>
        <Empty>Aún no hay unidades. Créalas con «Agregar unidades».</Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {[...byTower.entries()].map(([tower, list]) => (
        <Card key={tower || "sin-torre"}>
          <SectionTitle>
            {tower ? `Torre ${tower}` : "Sin torre"} <Badge>{list.length}</Badge>
          </SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                      {residents === 0 ? "Sin residentes" : `${residents} residente${residents === 1 ? "" : "s"}`}
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
      ))}
    </div>
  );
}
