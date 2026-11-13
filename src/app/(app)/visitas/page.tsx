import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Badge, Card, ContentSkeleton, Empty, PageHeader, SectionTitle, btnDanger, btnGhost, btnPrimary, btnSm } from "@/components/ui";
import { getProfile, isAdmin, unitLabel } from "@/lib/auth";
import { bogotaDateTime, fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { kindLabel, viewLabel, viewTone, visitView, type VisitStatus } from "@/lib/visits";
import { cancelVisit, createVisit, decideVisit } from "./actions";
import { VisitFields } from "./visit-fields";
import { VisitQr } from "./visit-qr";

export const metadata: Metadata = { title: "Visitas" };

type Visit = {
  id: string;
  unit_id: string;
  visitor_name: string;
  kind: string;
  plate: string | null;
  valid_from: string;
  valid_until: string;
  status: VisitStatus;
  code: string;
  source: "residente" | "porteria";
  notes: string | null;
  checked_in_at: string | null;
  units: { tower: string; number: string } | null;
};

export default function VisitasPage() {
  return (
    <>
      <PageHeader
        title="Visitas"
        description="Autoriza a tus visitas y vehículos temporales: portería los deja pasar con un código o QR."
        action={
          <Suspense fallback={null}>
            <NewVisit />
          </Suspense>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <VisitasContent />
      </Suspense>
    </>
  );
}

/** Hora actual de Colombia y +3 h (sin pasar de las 23:45) como valores iniciales del formulario. */
function defaultSlot() {
  const now = bogotaDateTime(new Date().toISOString());
  const [h, m] = now.time.split(":").map(Number);
  const start = `${String(h).padStart(2, "0")}:${String(Math.floor(m / 15) * 15).padStart(2, "0")}`;
  const endH = Math.min(h + 3, 23);
  const end = `${String(endH).padStart(2, "0")}:${endH === 23 ? "45" : String(Math.floor(m / 15) * 15).padStart(2, "0")}`;
  return { date: now.date, from: start, until: end };
}

async function NewVisit() {
  const profile = await getProfile();
  if (profile.role !== "residente" || !profile.unitId) return null;
  const slot = defaultSlot();

  return (
    <Modal
      title="Autorizar visita"
      description="Se genera un código y un QR para compartir con tu visitante."
      icon="users"
      trigger="Autorizar visita"
      plus
      size="lg"
    >
      <ActionForm action={createVisit} submitLabel="Autorizar" pendingLabel="Guardando…" variant="accent">
        <VisitFields defaultDate={slot.date} defaultFrom={slot.from} defaultUntil={slot.until} />
      </ActionForm>
    </Modal>
  );
}

async function VisitasContent() {
  const profile = await getProfile();
  const admin = isAdmin(profile);
  if (!admin && !(profile.role === "residente" && profile.unitId)) {
    return (
      <Card>
        <Empty>
          Las visitas las autorizan los residentes. Portería las valida desde «Accesos → Visitantes».
        </Empty>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select(
      "id, unit_id, visitor_name, kind, plate, valid_from, valid_until, status, code, source, notes, checked_in_at, units(tower, number)",
    )
    .order("valid_until", { ascending: false })
    .limit(80);
  const visits = (data ?? []) as unknown as Visit[];
  const now = new Date();

  const withView = visits.map((v) => ({ v, view: visitView(v, now) }));
  const pending = withView.filter((x) => x.view === "por_autorizar");
  const upcoming = withView.filter((x) => x.view === "esperada" || x.view === "programada");
  const inside = withView.filter((x) => x.view === "dentro");
  const history = withView.filter((x) => ["salio", "rechazada", "cancelada", "vencida"].includes(x.view)).slice(0, 15);

  const unitOf = (v: Visit) => (admin ? ` · ${unitLabel(v.units)}` : "");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="border-l-4 !border-l-accent">
          <SectionTitle>
            Portería pregunta por ti <Badge tone="accent">{pending.length}</Badge>
          </SectionTitle>
          <ul className="space-y-3">
            {pending.map(({ v }) => (
              <li key={v.id} className="rounded-lg border border-line bg-surface-2 p-3.5">
                <p className="font-semibold text-ink">
                  {v.visitor_name} <span className="font-normal text-muted">· {kindLabel(v.kind)}{unitOf(v)}</span>
                </p>
                <p className="text-sm text-muted">
                  Está en portería y pide ingresar{v.plate ? ` con el vehículo ${v.plate}` : ""}.
                  {v.notes ? ` ${v.notes}` : ""}
                </p>
                {!admin && (
                  <div className="mt-3 flex gap-2">
                    <form action={decideVisit}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="decision" value="aprobar" />
                      <button type="submit" className={`${btnPrimary} ${btnSm}`}>
                        Autorizar ingreso
                      </button>
                    </form>
                    <form action={decideVisit}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="decision" value="rechazar" />
                      <button type="submit" className={`${btnGhost} ${btnSm}`}>
                        Rechazar
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>Autorizadas</SectionTitle>
        {upcoming.length === 0 ? (
          <Empty>No tienes visitas autorizadas. Usa «Autorizar visita» para crear una.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map(({ v, view }) => (
              <li key={v.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-ink">
                      {v.visitor_name} <span className="font-normal text-muted">· {kindLabel(v.kind)}{unitOf(v)}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {fmtDateTime(v.valid_from)} → {fmtDateTime(v.valid_until)}
                    </p>
                    {v.plate && (
                      <p className="mt-0.5 text-sm">
                        <span className="font-mono font-bold tracking-widest text-ink">{v.plate}</span>{" "}
                        <span className="text-muted">· permiso temporal de vehículo</span>
                      </p>
                    )}
                  </div>
                  <Badge tone={viewTone[view]}>{viewLabel[view]}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!admin && (
                    <VisitQr
                      code={v.code}
                      name={v.visitor_name}
                      until={fmtDateTime(v.valid_until)}
                      unit={unitLabel(v.units)}
                      plate={v.plate}
                    />
                  )}
                  <CancelVisit visit={v} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {inside.length > 0 && (
        <Card>
          <SectionTitle>Dentro ahora</SectionTitle>
          <ul className="divide-y divide-line">
            {inside.map(({ v }) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {v.visitor_name} <span className="font-normal text-muted">· {kindLabel(v.kind)}{unitOf(v)}</span>
                  </p>
                  <p className="text-sm text-muted">
                    Ingresó {v.checked_in_at ? fmtDateTime(v.checked_in_at) : ""}
                    {v.plate ? ` · ${v.plate}` : ""}
                  </p>
                </div>
                <Badge tone="success">Dentro</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <SectionTitle>Historial</SectionTitle>
          <ul className="divide-y divide-line">
            {history.map(({ v, view }) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {v.visitor_name} <span className="font-normal text-muted">· {kindLabel(v.kind)}{unitOf(v)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {fmtDateTime(v.valid_from)}
                    {v.plate ? ` · ${v.plate}` : ""}
                  </p>
                </div>
                <Badge tone={viewTone[view]}>{viewLabel[view]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function CancelVisit({ visit: v }: { visit: Visit }) {
  return (
    <Modal title="Cancelar autorización" description={v.visitor_name} trigger="Cancelar" triggerClassName={`${btnGhost} ${btnSm}`}>
      <ActionForm action={cancelVisit} submitLabel="Cancelar autorización" pendingLabel="Cancelando…" buttonClassName={btnDanger}>
        <input type="hidden" name="id" value={v.id} />
        <p className="text-sm text-muted">El código y el QR dejarán de servir en portería.</p>
      </ActionForm>
    </Modal>
  );
}
