import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Badge, Card, Empty, SectionTitle, btnGhost, btnSm } from "@/components/ui";
import { unitLabel } from "@/lib/auth";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { unitOptions } from "@/lib/options";
import { createClient } from "@/lib/supabase/server";
import { kindLabel, viewLabel, viewTone, visitView, type VisitStatus } from "@/lib/visits";
import { checkOutVisitForm, registerWalkin } from "./visit-actions";
import { VisitorConsole } from "./visitor-console";
import { WalkinFields } from "./walkin-form";

type Row = {
  id: string;
  visitor_name: string;
  kind: string;
  plate: string | null;
  valid_from: string;
  valid_until: string;
  status: VisitStatus;
  code: string;
  source: "residente" | "porteria";
  checked_in_at: string | null;
  units: { tower: string; number: string } | null;
};

/** Pestaña «Visitantes» de portería: validar, registrar llegadas y ver quién espera y quién está dentro. */
export async function VisitorsPanel() {
  const supabase = await createClient();
  const horizon = new Date(new Date().getTime() - 24 * 3600_000).toISOString();

  const [visitsRes, unitsRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visitor_name, kind, plate, valid_from, valid_until, status, code, source, checked_in_at, units(tower, number)")
      .in("status", ["por_autorizar", "autorizada", "dentro"])
      .gte("valid_until", horizon)
      .order("valid_from")
      .limit(120),
    supabase.from("units").select("id, tower, number").order("tower").order("number"),
  ]);
  const rows = (visitsRes.data ?? []) as unknown as Row[];
  const now = new Date();
  const decorated = rows.map((v) => ({ v, view: visitView(v, now) }));

  const inside = decorated.filter((x) => x.view === "dentro");
  const waiting = decorated.filter((x) => x.view === "por_autorizar");
  const expected = decorated.filter((x) => x.view === "esperada" || x.view === "programada");

  return (
    <div className="space-y-6">
      <VisitorConsole />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">¿Llegó alguien sin aviso? Regístralo y pide autorización al residente.</p>
        <Modal
          title="Registrar llegada"
          description="El visitante queda registrado; el residente recibe un aviso."
          icon="users"
          trigger="Registrar llegada"
          plus
          size="lg"
        >
          <ActionForm action={registerWalkin} submitLabel="Registrar" pendingLabel="Registrando…" variant="accent">
            <WalkinFields unitOptions={unitOptions(unitsRes.data ?? [])} />
          </ActionForm>
        </Modal>
      </div>

      <Card>
        <SectionTitle>
          Dentro ahora {inside.length > 0 && <Badge tone="success">{inside.length}</Badge>}
        </SectionTitle>
        {inside.length === 0 ? (
          <Empty>No hay visitantes dentro.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {inside.map(({ v }) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {v.visitor_name} <span className="font-normal text-muted">· {kindLabel(v.kind)}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {unitLabel(v.units)} · ingresó {v.checked_in_at ? fmtTime(v.checked_in_at) : ""}
                    {v.plate ? ` · ${v.plate}` : ""}
                  </p>
                </div>
                <form action={checkOutVisitForm}>
                  <input type="hidden" name="id" value={v.id} />
                  <button type="submit" className={`${btnGhost} ${btnSm}`}>
                    Registrar salida
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {waiting.length > 0 && (
        <Card>
          <SectionTitle>
            Esperando respuesta del residente <Badge tone="accent">{waiting.length}</Badge>
          </SectionTitle>
          <ul className="divide-y divide-line">
            {waiting.map(({ v }) => (
              <li key={v.id} className="py-3 first:pt-0 last:pb-0">
                <p className="font-semibold text-ink">
                  {v.visitor_name} <span className="font-normal text-muted">· {kindLabel(v.kind)}</span>
                </p>
                <p className="text-sm text-muted">
                  {unitLabel(v.units)}
                  {v.plate ? ` · ${v.plate}` : ""} · pidió ingreso a las {fmtTime(v.valid_from)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>Autorizadas por residentes</SectionTitle>
        {expected.length === 0 ? (
          <Empty>No hay autorizaciones vigentes.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {expected.map(({ v, view }) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {v.visitor_name} <span className="font-normal text-muted">· {kindLabel(v.kind)}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {unitLabel(v.units)} · {fmtDateTime(v.valid_from)} → {fmtDateTime(v.valid_until)}
                  </p>
                  {v.plate && <p className="font-mono text-sm font-bold tracking-widest text-ink">{v.plate}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={viewTone[view]}>{viewLabel[view]}</Badge>
                  <span className="font-mono text-sm tracking-widest text-muted">{v.code}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          Para dejar pasar a una visita, escribe su código o escanea su QR arriba. Si llega en vehículo, también sirve
          decir «ingreso» y la placa en la pestaña Vehículos.
        </p>
      </Card>
    </div>
  );
}
