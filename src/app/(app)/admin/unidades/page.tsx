import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Card, ContentSkeleton, Empty, Field, inputCls } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { createUnits } from "./actions";
import { UnitsBoard, type UnitView } from "./units-board";

export const metadata: Metadata = { title: "Unidades" };

export default function UnidadesPage() {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Torres, pisos y apartamentos del conjunto.</p>
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
                  Separa con comas o espacios. Un rango como <span className="font-mono text-ink">101-110</span> crea
                  los diez de una vez; los que ya existan se omiten.
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
  const [unitsRes, packagesRes] = await Promise.all([
    supabase.from("units").select("id, tower, number, profiles(id, full_name, email)"),
    supabase.from("packages").select("unit_id").eq("status", "recibido"),
  ]);

  const pending = new Map<string, number>();
  for (const p of packagesRes.data ?? []) pending.set(p.unit_id, (pending.get(p.unit_id) ?? 0) + 1);

  const rows = (unitsRes.data ?? []) as unknown as {
    id: string;
    tower: string;
    number: string;
    profiles: { id: string; full_name: string; email: string | null }[] | null;
  }[];
  const units: UnitView[] = rows.map((u) => ({
    id: u.id,
    tower: u.tower,
    number: u.number,
    residents: (u.profiles ?? []).map((p) => ({ id: p.id, name: p.full_name, email: p.email })),
    pendingPackages: pending.get(u.id) ?? 0,
  }));

  if (units.length === 0) {
    return (
      <Card>
        <Empty>Aún no hay unidades. Créalas con «Agregar unidades».</Empty>
      </Card>
    );
  }

  return <UnitsBoard units={units} />;
}
