import type { Metadata } from "next";
import { Suspense } from "react";
import { Modal } from "@/components/modal";
import { Card, ContentSkeleton, Empty } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { CreateUnitsForm } from "./create-units-form";
import { UnitsBoard, type UnitView } from "./units-board";

export const metadata: Metadata = { title: "Unidades" };

export default function UnidadesPage() {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Torres, pisos y unidades del conjunto, como los organizaste.</p>
        <Modal
          title="Agregar unidades"
          description="Describe cómo está organizado el conjunto: por pisos o con una lista libre."
          size="lg"
          icon="building"
          trigger="Agregar unidades"
          plus
        >
          <CreateUnitsForm />
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
    supabase.from("units").select("id, tower, number, floor, profiles(id, full_name, email)"),
    supabase.from("packages").select("unit_id").eq("status", "recibido"),
  ]);

  const pending = new Map<string, number>();
  for (const p of packagesRes.data ?? []) pending.set(p.unit_id, (pending.get(p.unit_id) ?? 0) + 1);

  const rows = (unitsRes.data ?? []) as unknown as {
    id: string;
    tower: string;
    number: string;
    floor: number | null;
    profiles: { id: string; full_name: string; email: string | null }[] | null;
  }[];
  const units: UnitView[] = rows.map((u) => ({
    id: u.id,
    tower: u.tower,
    number: u.number,
    floor: u.floor,
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
