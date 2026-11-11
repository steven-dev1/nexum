"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Card, Empty, btnDanger, inputCls } from "@/components/ui";
import { deleteUnit } from "./actions";

export type UnitView = {
  id: string;
  tower: string;
  number: string;
  residents: { id: string; name: string; email: string | null }[];
  pendingPackages: number;
};

type Occupancy = "all" | "occupied" | "vacant";

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Piso a partir del número: 302 → 3, 1205 → 12. Números cortos o con letras van aparte. */
function floorOf(number: string): number | null {
  if (!/^\d+$/.test(number)) return null;
  const n = Number(number);
  return n >= 100 ? Math.floor(n / 100) : null;
}

const towerName = (tower: string) => (tower ? `Torre ${tower}` : "Sin torre");
const unitName = (u: UnitView) => (u.tower ? `Torre ${u.tower} · Apto ${u.number}` : `Apto ${u.number}`);

const icon = (d: ReactNode, cls = "size-4") => (
  <svg
    className={cls}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {d}
  </svg>
);
const userIcon = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a7 7 0 0 1 16 0v1" />
  </>,
  "size-3.5",
);

/** Tablero de unidades: resumen, filtros y cada torre por pisos. */
export function UnitsBoard({ units }: { units: UnitView[] }) {
  const [query, setQuery] = useState("");
  const [tower, setTower] = useState<string>("__all");
  const [occupancy, setOccupancy] = useState<Occupancy>("all");

  const towers = useMemo(
    () =>
      [...new Set(units.map((u) => u.tower))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : collator.compare(a, b))),
    [units],
  );

  const stats = useMemo(() => {
    const occupied = units.filter((u) => u.residents.length > 0).length;
    return {
      total: units.length,
      towers: towers.filter(Boolean).length,
      occupied,
      vacant: units.length - occupied,
      residents: units.reduce((n, u) => n + u.residents.length, 0),
      packages: units.reduce((n, u) => n + u.pendingPackages, 0),
    };
  }, [units, towers]);

  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return units.filter((u) => {
      if (tower !== "__all" && u.tower !== tower) return false;
      if (occupancy === "occupied" && u.residents.length === 0) return false;
      if (occupancy === "vacant" && u.residents.length > 0) return false;
      if (words.length === 0) return true;
      const haystack = normalize(
        `torre ${u.tower} apto ${u.number} ${u.residents.map((r) => `${r.name} ${r.email ?? ""}`).join(" ")}`,
      );
      return words.every((w) => haystack.includes(w));
    });
  }, [units, query, tower, occupancy]);

  const groups = useMemo(() => {
    return towers
      .map((t) => {
        const list = filtered.filter((u) => u.tower === t);
        // Pisos de arriba hacia abajo, como el edificio; las unidades sin piso al final.
        const floors = new Map<number | null, UnitView[]>();
        for (const u of [...list].sort((a, b) => collator.compare(a.number, b.number))) {
          const f = floorOf(u.number);
          floors.set(f, [...(floors.get(f) ?? []), u]);
        }
        const ordered = [...floors.entries()].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a));
        const all = units.filter((u) => u.tower === t);
        return {
          tower: t,
          floors: ordered,
          count: list.length,
          total: all.length,
          occupied: all.filter((u) => u.residents.length > 0).length,
        };
      })
      .filter((g) => g.count > 0);
  }, [towers, filtered, units]);

  const chip = (active: boolean) =>
    `cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
      active ? "bg-primary text-on-primary" : "text-muted hover:bg-surface hover:text-ink"
    }`;

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Unidades" value={stats.total} hint={`${stats.towers} torre${stats.towers === 1 ? "" : "s"}`} />
        <Stat label="Ocupadas" value={stats.occupied} hint={`${stats.residents} residentes`} tone="primary" />
        <Stat label="Sin residentes" value={stats.vacant} hint="Disponibles para asignar" />
        <Stat
          label="Paquetes por recoger"
          value={stats.packages}
          hint="En portería"
          tone={stats.packages ? "accent" : undefined}
        />
      </div>

      {/* Filtros */}
      <Card className="!p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-72">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              {icon(
                <>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </>,
              )}
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar apto o residente…"
              aria-label="Buscar unidad o residente"
              className={`${inputCls} !py-2 pl-10 text-sm`}
            />
          </div>

          {towers.length > 1 && (
            <div role="group" aria-label="Torre" className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
              <button
                type="button"
                aria-pressed={tower === "__all"}
                onClick={() => setTower("__all")}
                className={chip(tower === "__all")}
              >
                Todas
              </button>
              {towers.map((t) => (
                <button
                  key={t || "none"}
                  type="button"
                  aria-pressed={tower === t}
                  onClick={() => setTower(t)}
                  className={chip(tower === t)}
                >
                  {towerName(t)}
                </button>
              ))}
            </div>
          )}

          <div role="group" aria-label="Ocupación" className="flex gap-1 rounded-xl bg-surface-2 p-1 lg:ml-auto">
            {(
              [
                ["all", "Todas"],
                ["occupied", "Ocupadas"],
                ["vacant", "Sin residentes"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={occupancy === value}
                onClick={() => setOccupancy(value)}
                className={chip(occupancy === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Torres por pisos */}
      {groups.length === 0 ? (
        <Card>
          <Empty>Ninguna unidad coincide con los filtros.</Empty>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.tower || "none"}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary">
                  {icon(
                    <>
                      <rect x="4" y="2" width="16" height="20" rx="2" />
                      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
                    </>,
                    "size-5",
                  )}
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">{towerName(g.tower)}</h2>
                  <p className="text-xs text-muted">
                    {g.total} unidades · {g.occupied} ocupadas · {g.total - g.occupied} sin residentes
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-48">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${g.total ? (g.occupied / g.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-muted">
                  {g.total ? Math.round((g.occupied / g.total) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {g.floors.map(([floor, list]) => (
                <div key={floor ?? "otros"} className="flex gap-3 rounded-xl bg-bg/60 p-2">
                  <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-2 py-1 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {floor === null ? "Otras" : "Piso"}
                    </span>
                    {floor !== null && <span className="text-lg font-bold leading-6 text-ink">{floor}</span>}
                  </div>
                  <ul className="flex flex-1 flex-wrap gap-2">
                    {list.map((u) => (
                      <li key={u.id}>
                        <UnitChip unit={u} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded border border-primary/40 bg-primary-soft" /> Ocupada
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded border border-dashed border-muted/60" /> Sin residentes
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-accent" /> Paquetes por recoger
        </span>
        <span>Toca una unidad para ver el detalle.</span>
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "primary" | "accent";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${tone === "primary" ? "text-primary-ink" : "text-ink"}`}>
        {value}
        {tone === "accent" && value > 0 && (
          <span aria-hidden className="ml-2 inline-block size-2.5 rounded-full bg-accent align-middle" />
        )}
      </p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

/** Ficha de una unidad; al tocarla abre el detalle. */
function UnitChip({ unit: u }: { unit: UnitView }) {
  const occupied = u.residents.length > 0;
  return (
    <Modal
      title={unitName(u)}
      description={
        occupied ? `${u.residents.length} residente${u.residents.length === 1 ? "" : "s"}` : "Sin residentes asignados"
      }
      icon="building"
      triggerLabel={`${unitName(u)}: ${occupied ? `${u.residents.length} residentes` : "sin residentes"}${
        u.pendingPackages ? `, ${u.pendingPackages} paquetes por recoger` : ""
      }`}
      triggerClassName={`relative flex w-[5.25rem] cursor-pointer flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-colors ${
        occupied
          ? "border-primary/40 bg-primary-soft text-primary-ink hover:border-primary"
          : "border-dashed border-muted/50 bg-surface text-muted hover:border-primary hover:text-ink"
      }`}
      trigger={
        <>
          <span className="text-sm font-bold text-ink">{u.number}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium">
            {occupied ? (
              <>
                {userIcon}
                {u.residents.length}
              </>
            ) : (
              "Vacía"
            )}
          </span>
          {u.pendingPackages > 0 && (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink ring-2 ring-surface">
              {u.pendingPackages}
            </span>
          )}
        </>
      }
    >
      {/* Solo se ofrece eliminar si no hay residentes ni paquetes pendientes (la BD lo impediría). */}
      {occupied || u.pendingPackages > 0 ? (
        <div className="space-y-4 border-t border-line px-6 py-5">
          <UnitDetail unit={u} />
        </div>
      ) : (
        <ActionForm
          action={deleteUnit}
          submitLabel="Eliminar unidad"
          pendingLabel="Eliminando…"
          buttonClassName={btnDanger}
        >
          <input type="hidden" name="id" value={u.id} />
          <UnitDetail unit={u} />
        </ActionForm>
      )}
    </Modal>
  );
}

function UnitDetail({ unit: u }: { unit: UnitView }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Residentes</p>
          <p className="text-2xl font-bold text-ink">{u.residents.length}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Paquetes por recoger</p>
          <p className="text-2xl font-bold text-ink">{u.pendingPackages}</p>
        </div>
      </div>

      {u.residents.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {u.residents.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink">
                {(r.name || r.email || "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.name || "Sin nombre"}</p>
                <p className="truncate text-xs text-muted">{r.email ?? "—"}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          Nadie vive aquí todavía según el sistema. Asigna residentes desde{" "}
          <Link href="/admin/usuarios" className="font-semibold text-primary-ink underline-offset-2 hover:underline">
            Usuarios
          </Link>
          . Si la unidad no existe y no tiene paquetes pendientes, puedes eliminarla.
        </p>
      )}

      {u.pendingPackages > 0 && (
        <Link
          href="/paqueteria"
          className="flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-semibold text-ink hover:brightness-95"
        >
          Ver paquetes en portería
          <span aria-hidden>→</span>
        </Link>
      )}
    </>
  );
}
