import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, ContentSkeleton, SectionTitle } from "@/components/ui";
import { DATASETS } from "@/lib/export/datasets";
import { addDays, todayInBogota } from "@/lib/export/range";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Reportes" };

export default function ReportesPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ReportesContent />
    </Suspense>
  );
}

async function ReportesContent() {
  // «Hoy» cambia a diario: la página se arma en cada visita, no al compilar.
  await connection();
  const today = todayInBogota();

  return (
    <div className="max-w-2xl">
      <Card>
        <SectionTitle>Exportar reportes</SectionTitle>
        <p className="mb-5 text-sm text-muted">
          Descarga la información del conjunto en Excel o PDF. Los reportes con fechas usan el rango que elijas (por
          defecto, los últimos 30 días).
        </p>
        <ReportForm
          options={DATASETS.filter((d) => d.access === "admin" || d.access === "staff").map((d) => ({
            key: d.key,
            label: d.label,
            description: d.description,
            ranged: d.ranged,
          }))}
          defaultFrom={addDays(today, -29)}
          defaultTo={today}
        />
      </Card>
    </div>
  );
}
