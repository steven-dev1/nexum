import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Select } from "@/components/select";
import { unitOptions } from "@/lib/options";
import {
  Badge,
  Card,
  ContentSkeleton,
  Empty,
  Field,
  PageHeader,
  SectionTitle,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSm,
  inputCls,
} from "@/components/ui";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PhotoCapture } from "@/components/photo-capture";
import { deletePackage, deliverPackage, registerPackage, updatePackage } from "./actions";
import { PhotoThumb } from "./photo-thumb";

export const metadata: Metadata = { title: "Paquetería" };

type Unit = { id: string; tower: string; number: string };

type Pkg = {
  id: string;
  unit_id: string;
  recipient_name: string | null;
  carrier: string | null;
  description: string | null;
  status: "recibido" | "entregado" | "devuelto";
  received_at: string;
  delivered_at: string | null;
  delivered_to: string | null;
  photo_path: string | null;
  units: { tower: string; number: string } | null;
};

export default function PaqueteriaPage() {
  return (
    <>
      <PageHeader
        title="Paquetería"
        description="Paquetes que llegan a portería: registro, aviso y entrega."
        action={
          <Suspense fallback={null}>
            <RegisterPackage />
          </Suspense>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <PaqueteriaContent />
      </Suspense>
    </>
  );
}

/** Botón + modal de registro: solo portería y administración. */
async function RegisterPackage() {
  const profile = await getProfile();
  if (!isStaff(profile)) return null;

  const supabase = await createClient();
  const { data: units } = await supabase.from("units").select("id, tower, number").order("tower").order("number");

  return (
    <Modal
      title="Registrar paquete"
      description="Queda pendiente de entrega y el residente lo ve en su panel."
      icon="package"
      trigger="Registrar paquete"
      plus
    >
      <ActionForm action={registerPackage} submitLabel="Registrar" pendingLabel="Registrando…" variant="accent">
        {!units || units.length === 0 ? (
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
            Aún no hay unidades. Créalas en{" "}
            <Link href="/admin/unidades" className="font-semibold text-primary-ink underline">
              Administración → Unidades
            </Link>
            .
          </p>
        ) : null}
        <Select
          label="Unidad destinataria"
          name="unit_id"
          required
          placeholder="Selecciona la unidad…"
          options={unitOptions(units ?? [])}
          autoFocus
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa / mensajero">
            <input name="carrier" placeholder="Servientrega, Rappi…" className={inputCls} />
          </Field>
          <Field label="Destinatario (opcional)">
            <input name="recipient_name" placeholder="Nombre en la guía" className={inputCls} />
          </Field>
        </div>
        <Field label="Descripción">
          <input name="description" placeholder="Caja mediana, sobre, nevera de icopor…" className={inputCls} />
        </Field>
        <PhotoCapture name="photo" label="Foto del paquete (opcional)" />
      </ActionForm>
    </Modal>
  );
}

async function PaqueteriaContent() {
  const profile = await getProfile();
  const staff = isStaff(profile);
  const supabase = await createClient();

  const select =
    "id, unit_id, recipient_name, carrier, description, status, received_at, delivered_at, delivered_to, photo_path, units(tower, number)";

  const [pendingRes, historyRes, unitsRes] = await Promise.all([
    supabase.from("packages").select(select).eq("status", "recibido").order("received_at", { ascending: false }),
    supabase
      .from("packages")
      .select(select)
      .neq("status", "recibido")
      .order("received_at", { ascending: false })
      .limit(20),
    staff
      ? supabase.from("units").select("id, tower, number").order("tower").order("number")
      : Promise.resolve({ data: [] as Unit[] }),
  ]);

  const pending = (pendingRes.data ?? []) as unknown as Pkg[];
  const history = (historyRes.data ?? []) as unknown as Pkg[];
  const units = (unitsRes.data ?? []) as Unit[];

  // URLs firmadas (1 h) para las fotos; el bucket es privado y la RLS decide quién las ve.
  const paths = [...pending, ...history].map((p) => p.photo_path).filter((p): p is string => !!p);
  const photoUrls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("package-photos").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) photoUrls.set(s.path, s.signedUrl);
  }
  const photoOf = (p: Pkg) => (p.photo_path ? photoUrls.get(p.photo_path) : undefined);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>
          {staff ? "Por entregar" : "Por recoger"} {pending.length > 0 && <Badge tone="accent">{pending.length}</Badge>}
        </SectionTitle>
        {pending.length === 0 ? (
          <Empty>No hay paquetes pendientes.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {photoOf(p) && (
                    <PhotoThumb url={photoOf(p)!} title={`${p.carrier ?? "Paquete"} · ${unitLabel(p.units)}`} />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {p.carrier ?? "Paquete"} <span className="font-normal text-muted">· {unitLabel(p.units)}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {[p.recipient_name, p.description].filter(Boolean).join(" — ") || "Sin descripción"}
                    </p>
                    <p className="text-xs text-muted">Llegó {fmtDateTime(p.received_at)}</p>
                  </div>
                </div>
                {staff && (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={deliverPackage} className="flex gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        name="delivered_to"
                        placeholder="Quién recibe"
                        aria-label="Quién recibe"
                        className={`${inputCls} sm:w-40`}
                      />
                      <button type="submit" className={`${btnPrimary} ${btnSm} shrink-0`}>
                        Entregar
                      </button>
                    </form>
                    <EditPackage pkg={p} units={units} />
                    <DeletePackage pkg={p} />
                  </div>
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
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  {photoOf(p) && (
                    <PhotoThumb url={photoOf(p)!} title={`${p.carrier ?? "Paquete"} · ${unitLabel(p.units)}`} />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {p.carrier ?? "Paquete"} <span className="font-normal text-muted">· {unitLabel(p.units)}</span>
                    </p>
                    <p className="text-xs text-muted">
                      Llegó {fmtDateTime(p.received_at)}
                      {p.delivered_at ? ` · entregado ${fmtDateTime(p.delivered_at)}` : ""}
                      {p.delivered_to ? ` · recibió ${p.delivered_to}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.status === "entregado" ? "success" : "neutral"}>
                    {p.status === "entregado" ? "Entregado" : "Devuelto"}
                  </Badge>
                  {staff && <DeletePackage pkg={p} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Botón + modal de edición (solo portería y administración). */
function EditPackage({ pkg, units }: { pkg: Pkg; units: Unit[] }) {
  return (
    <Modal
      title="Editar paquete"
      description={`${pkg.carrier ?? "Paquete"} · ${unitLabel(pkg.units)}`}
      icon="edit"
      trigger="Editar"
      triggerClassName={`${btnGhost} ${btnSm}`}
    >
      <ActionForm action={updatePackage} submitLabel="Guardar cambios" pendingLabel="Guardando…">
        <input type="hidden" name="id" value={pkg.id} />
        <Select
          label="Unidad destinataria"
          name="unit_id"
          required
          placeholder="Selecciona la unidad…"
          options={unitOptions(units)}
          defaultValue={pkg.unit_id}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa / mensajero">
            <input
              name="carrier"
              defaultValue={pkg.carrier ?? ""}
              placeholder="Servientrega, Rappi…"
              className={inputCls}
            />
          </Field>
          <Field label="Destinatario (opcional)">
            <input
              name="recipient_name"
              defaultValue={pkg.recipient_name ?? ""}
              placeholder="Nombre en la guía"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Descripción">
          <input
            name="description"
            defaultValue={pkg.description ?? ""}
            placeholder="Caja mediana, sobre, nevera de icopor…"
            className={inputCls}
          />
        </Field>
      </ActionForm>
    </Modal>
  );
}

/** Confirmación de borrado (solo portería y administración). */
function DeletePackage({ pkg }: { pkg: Pkg }) {
  return (
    <Modal
      title="Eliminar paquete"
      description={`${pkg.carrier ?? "Paquete"} · ${unitLabel(pkg.units)}`}
      trigger="Eliminar"
      triggerClassName={`${btnGhost} ${btnSm}`}
    >
      <ActionForm
        action={deletePackage}
        submitLabel="Eliminar paquete"
        pendingLabel="Eliminando…"
        buttonClassName={btnDanger}
      >
        <input type="hidden" name="id" value={pkg.id} />
        <p className="text-sm text-muted">
          Se borra el registro{pkg.photo_path ? " y su foto" : ""}. Esta acción no se puede deshacer.
        </p>
      </ActionForm>
    </Modal>
  );
}
