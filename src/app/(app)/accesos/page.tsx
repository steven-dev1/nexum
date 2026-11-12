import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, Card, ContentSkeleton, Empty, PageHeader, SectionTitle, btnGhost, btnSm } from "@/components/ui";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { bogotaToIso, fmtTime, todayBogota } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { undoAccessForm } from "./actions";
import { VoiceConsole } from "./voice-console";

export const metadata: Metadata = { title: "Accesos" };

export default function AccesosPage() {
  return (
    <>
      <PageHeader
        title="Acceso de vehículos"
        description="Di «ingresa placa» y la placa, o escríbela. Se valida contra los vehículos registrados."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <AccesosContent />
      </Suspense>
    </>
  );
}

type Row = {
  id: string;
  plate: string;
  direction: "ingreso" | "salida";
  result: "autorizado" | "no_registrada" | "inactivo";
  method: "voz" | "manual";
  at: string;
  voided_at: string | null;
  units: { tower: string; number: string } | null;
};

const resultTone = { autorizado: "success", no_registrada: "danger", inactivo: "danger" } as const;
const resultLabel = { autorizado: "Autorizado", no_registrada: "No registrada", inactivo: "Inactivo" } as const;

async function AccesosContent() {
  const profile = await getProfile();
  if (!isStaff(profile)) {
    return (
      <Card>
        <Empty>Esta sección es para portería y administración.</Empty>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicle_access_log")
    .select("id, plate, direction, result, method, at, voided_at, units(tower, number)")
    .gte("at", bogotaToIso(todayBogota(), "00:00"))
    .order("at", { ascending: false })
    .limit(40);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <VoiceConsole />

      <Card>
        <SectionTitle>Movimientos de hoy</SectionTitle>
        {rows.length === 0 ? (
          <Empty>Aún no hay movimientos hoy.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 ${r.voided_at ? "opacity-55" : ""}`}>
                <div className="min-w-0">
                  <p className="font-mono text-base font-bold tracking-widest text-ink">{r.plate}</p>
                  <p className="text-xs text-muted">
                    {fmtTime(r.at)} · {r.direction === "ingreso" ? "Ingreso" : "Salida"} · {r.units ? unitLabel(r.units) : "Sin unidad"} ·{" "}
                    {r.method === "voz" ? "voz" : "manual"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.voided_at ? <Badge>Anulado</Badge> : <Badge tone={resultTone[r.result]}>{resultLabel[r.result]}</Badge>}
                  {!r.voided_at && r.result === "autorizado" && (
                    <form action={undoAccessForm}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={`${btnGhost} ${btnSm}`}>
                        Anular
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
