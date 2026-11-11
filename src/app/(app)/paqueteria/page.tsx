import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import {
  Badge,
  Card,
  Empty,
  Field,
  PageHeader,
  SectionTitle,
  btnPrimary,
  btnSm,
  inputCls,
} from "@/components/ui";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { deliverPackage, registerPackage } from "./actions";

export const metadata: Metadata = { title: "Paquetería" };

type Pkg = {
  id: string;
  recipient_name: string | null;
  carrier: string | null;
  description: string | null;
  status: "recibido" | "entregado" | "devuelto";
  received_at: string;
  delivered_at: string | null;
  delivered_to: string | null;
  units: { tower: string; number: string } | null;
};

export default async function PaqueteriaPage() {
  const profile = await getProfile();
  const staff = isStaff(profile);
  const supabase = await createClient();

  const select =
    "id, recipient_name, carrier, description, status, received_at, delivered_at, delivered_to, units(tower, number)";

  const [pendingRes, historyRes, unitsRes] = await Promise.all([
    supabase.from("packages").select(select).eq("status", "recibido").order("received_at", { ascending: false }),
    supabase.from("packages").select(select).neq("status", "recibido").order("received_at", { ascending: false }).limit(15),
    staff
      ? supabase.from("units").select("id, tower, number").order("tower").order("number")
      : Promise.resolve({ data: [] as { id: string; tower: string; number: string }[] }),
  ]);

  const pending = (pendingRes.data ?? []) as unknown as Pkg[];
  const history = (historyRes.data ?? []) as unknown as Pkg[];
  const units = unitsRes.data ?? [];

  return (
    <>
      <PageHeader
        title="Paquetería"
        description={
          staff
            ? "Registra los paquetes que llegan a portería y confirma su entrega."
            : "Los paquetes de tu unidad que están en portería."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <SectionTitle>
              Por recoger {pending.length > 0 && <Badge tone="accent">{pending.length}</Badge>}
            </SectionTitle>
            {pending.length === 0 ? (
              <Empty>No hay paquetes pendientes.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {pending.map((p) => (
                  <li key={p.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {p.carrier ?? "Paquete"}{" "}
                        <span className="font-normal text-muted">· {unitLabel(p.units)}</span>
                      </p>
                      <p className="text-sm text-muted">
                        {[p.recipient_name, p.description].filter(Boolean).join(" — ") || "Sin descripción"}
                      </p>
                      <p className="text-xs text-muted">Llegó {fmtDateTime(p.received_at)}</p>
                    </div>
                    {staff && (
                      <form action={deliverPackage} className="flex gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          name="delivered_to"
                          placeholder="Quién recibe"
                          aria-label="Quién recibe"
                          className={`${inputCls} sm:w-36`}
                        />
                        <button type="submit" className={`${btnPrimary} ${btnSm} shrink-0`}>
                          Entregar
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle>Historial reciente</SectionTitle>
            {history.length === 0 ? (
              <Empty>Aún no hay entregas registradas.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {p.carrier ?? "Paquete"}{" "}
                        <span className="font-normal text-muted">· {unitLabel(p.units)}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {p.delivered_at ? `Entregado ${fmtDateTime(p.delivered_at)}` : `Llegó ${fmtDateTime(p.received_at)}`}
                        {p.delivered_to ? ` · recibió ${p.delivered_to}` : ""}
                      </p>
                    </div>
                    <Badge tone={p.status === "entregado" ? "success" : "neutral"}>
                      {p.status === "entregado" ? "Entregado" : "Devuelto"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {staff && (
          <Card className="h-fit lg:sticky lg:top-8">
            <SectionTitle>Registrar paquete</SectionTitle>
            <ActionForm action={registerPackage} submitLabel="Registrar" variant="accent">
              <Field label="Unidad">
                <select name="unit_id" required defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {unitLabel(u)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Destinatario (opcional)">
                <input name="recipient_name" className={inputCls} />
              </Field>
              <Field label="Empresa / mensajero">
                <input name="carrier" placeholder="Servientrega, Rappi…" className={inputCls} />
              </Field>
              <Field label="Descripción">
                <input name="description" placeholder="Caja mediana, sobre…" className={inputCls} />
              </Field>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
