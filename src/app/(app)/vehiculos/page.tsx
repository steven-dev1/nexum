import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Badge, Card, ContentSkeleton, Empty, PageHeader, btnDanger, btnGhost, btnSm, inputCls } from "@/components/ui";
import { getProfile, isAdmin, unitLabel } from "@/lib/auth";
import { unitOptions } from "@/lib/options";
import { createClient } from "@/lib/supabase/server";
import { createVehicle, deleteVehicle, updateVehicle } from "./actions";
import { PhotoThumb } from "@/components/photo-thumb";
import { VehicleFields } from "./vehicle-fields";

export const metadata: Metadata = { title: "Vehículos" };

const kindLabel: Record<string, string> = { carro: "Carro", moto: "Moto", otro: "Otro" };
const LIMIT = 50;

type Vehicle = {
  id: string;
  plate: string;
  kind: string;
  brand: string | null;
  color: string | null;
  active: boolean;
  unit_id: string;
  photo_path: string | null;
  units: { tower: string; number: string } | null;
};

export default function VehiculosPage({ searchParams }: PageProps<"/vehiculos">) {
  return (
    <>
      <PageHeader
        title="Vehículos"
        description="Los vehículos registrados pueden ingresar al conjunto; portería los valida por placa."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <VehiculosContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function VehiculosContent({ searchParams }: { searchParams: PageProps<"/vehiculos">["searchParams"] }) {
  const profile = await getProfile();
  const admin = isAdmin(profile);
  const canRegister = admin || (profile.role === "residente" && !!profile.unitId);

  if (!canRegister) {
    return (
      <Card>
        <Empty>
          Los vehículos los registran los residentes y la administración. Portería los consulta y valida desde «Accesos».
        </Empty>
      </Card>
    );
  }

  const params = await searchParams;
  // Solo letras y números: la placa no lleva otros caracteres (y evita comodines en el filtro).
  const q = first(params.q).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

  const supabase = await createClient();
  let list = supabase
    .from("vehicles")
    .select("id, plate, kind, brand, color, active, unit_id, photo_path, units(tower, number)")
    .order("plate")
    .limit(LIMIT);
  if (!admin) list = list.eq("unit_id", profile.unitId!);
  if (admin && q) list = list.ilike("plate", `%${q}%`);

  const [listRes, unitsRes] = await Promise.all([
    list,
    admin ? supabase.from("units").select("id, tower, number").order("tower").order("number") : Promise.resolve({ data: null }),
  ]);
  const vehicles = (listRes.data ?? []) as unknown as Vehicle[];
  const options = unitsRes.data ? unitOptions(unitsRes.data) : undefined;

  // URLs firmadas (1 h): el bucket es privado y la RLS decide quién ve cada foto.
  const photoUrls = new Map<string, string>();
  const paths = vehicles.map((v) => v.photo_path).filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("vehicle-photos").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) photoUrls.set(s.path, s.signedUrl);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {admin ? (
          <form className="flex gap-2" role="search">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar placa…"
              aria-label="Buscar por placa"
              maxLength={7}
              className={`${inputCls} max-w-48 font-mono uppercase tracking-widest`}
            />
            <button type="submit" className={`${btnGhost}`}>
              Buscar
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">Los de tu unidad ({profile.unitLabel}).</p>
        )}
        <Modal
          title="Registrar vehículo"
          description={admin ? "Elige la unidad a la que pertenece." : "Quedará asociado a tu unidad."}
          icon="building"
          trigger="Registrar vehículo"
          plus
        >
          <ActionForm action={createVehicle} submitLabel="Registrar" pendingLabel="Guardando…" variant="accent">
            <VehicleFields unitOptions={options} />
          </ActionForm>
        </Modal>
      </div>

      <Card>
        {vehicles.length === 0 ? (
          <Empty>{q ? "No hay vehículos con esa placa." : "Aún no hay vehículos registrados."}</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {vehicles.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  {v.photo_path && photoUrls.get(v.photo_path) ? (
                    <PhotoThumb
                      url={photoUrls.get(v.photo_path)!}
                      title={`${v.plate} · ${[kindLabel[v.kind], v.brand, v.color].filter(Boolean).join(" · ")}`}
                      description="Foto del vehículo, para identificarlo en portería."
                      icon="building"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-surface-2 text-muted sm:size-16"
                    >
                      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 17h14M3 13l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 6v4a1 1 0 0 1-1 1h-1.5a1.5 1.5 0 0 1-3 0h-7a1.5 1.5 0 0 1-3 0H4a1 1 0 0 1-1-1v-4z" />
                      </svg>
                    </span>
                  )}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-bold tracking-widest text-ink">{v.plate}</span>
                    {!v.active && <Badge tone="danger">Inactivo</Badge>}
                  </p>
                  <p className="text-sm text-muted">
                    {[kindLabel[v.kind], v.brand, v.color].filter(Boolean).join(" · ")}
                    {admin && ` · ${unitLabel(v.units)}`}
                  </p>
                </div>
                </div>
                <div className="flex gap-2">
                  <EditVehicle vehicle={v} photoUrl={v.photo_path ? photoUrls.get(v.photo_path) : undefined} />
                  <DeleteVehicle vehicle={v} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {vehicles.length === LIMIT && <p className="mt-3 text-xs text-muted">Se muestran los primeros {LIMIT}; usa la búsqueda.</p>}
      </Card>
    </div>
  );
}

function EditVehicle({ vehicle: v, photoUrl }: { vehicle: Vehicle; photoUrl?: string }) {
  return (
    <Modal title="Editar vehículo" description={v.plate} icon="edit" trigger="Editar" triggerClassName={`${btnGhost} ${btnSm}`}>
      <ActionForm action={updateVehicle} submitLabel="Guardar cambios" pendingLabel="Guardando…">
        <input type="hidden" name="id" value={v.id} />
        <VehicleFields
          editing
          defaults={{ plate: v.plate, kind: v.kind, brand: v.brand ?? "", color: v.color ?? "", active: v.active, photoUrl }}
        />
      </ActionForm>
    </Modal>
  );
}

function DeleteVehicle({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <Modal title="Quitar vehículo" description={v.plate} trigger="Quitar" triggerClassName={`${btnGhost} ${btnSm}`}>
      <ActionForm action={deleteVehicle} submitLabel="Quitar" pendingLabel="Quitando…" buttonClassName={btnDanger}>
        <input type="hidden" name="id" value={v.id} />
        <p className="text-sm text-muted">
          Ya no podrá ingresar por placa. Su historial de accesos se conserva.
        </p>
      </ActionForm>
    </Modal>
  );
}
