import { fmtDateTime } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";
import { unitFullLabel } from "@/lib/units";
import type { DayRange } from "./range";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Cell = string | number | null;

export type Dataset = {
  key: string;
  label: string;
  description: string;
  /** Quién puede exportarlo: solo administración, o también portería. */
  access: "admin" | "staff";
  /** Si depende del rango de fechas (si no, se exporta todo lo actual). */
  ranged: boolean;
  columns: { header: string; width?: number }[];
  load(supabase: Supabase, range: DayRange): Promise<Cell[][]>;
};

/** Máximo de filas por archivo (más allá, conviene acotar el rango). */
export const MAX_ROWS = 10_000;
const PAGE = 1000; // PostgREST entrega como máximo 1000 filas por consulta

/** Lee una consulta por páginas de 1000 hasta agotarla o llegar al máximo. */
async function paged<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < MAX_ROWS; i += PAGE) {
    const { data } = await page(i, i + PAGE - 1);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

type Joined = { tower: string; number: string } | null;
const unit = (u: Joined) => (u ? unitFullLabel(u) : "");
const when = (iso: string | null | undefined) => (iso ? fmtDateTime(iso) : "");
const yesNo = (b: boolean) => (b ? "Sí" : "No");

const ROLE: Record<string, string> = { residente: "Residente", porteria: "Portería", admin: "Administración" };
const PKG_STATUS: Record<string, string> = { recibido: "Por entregar", entregado: "Entregado", devuelto: "Devuelto" };
const RES_STATUS: Record<string, string> = { confirmada: "Confirmada", cancelada: "Cancelada" };
const RESULT: Record<string, string> = { autorizado: "Autorizado", no_registrada: "No registrada", inactivo: "Inactivo" };
const VISIT_STATUS: Record<string, string> = {
  por_autorizar: "Por autorizar",
  autorizada: "Autorizada",
  rechazada: "Rechazada",
  dentro: "Dentro",
  salio: "Salió",
  cancelada: "Cancelada",
};
const KIND: Record<string, string> = {
  visita: "Visita",
  domiciliario: "Domicilio",
  proveedor: "Proveedor",
  mudanza: "Mudanza",
  otro: "Otro",
};

export const DATASETS: Dataset[] = [
  {
    key: "usuarios",
    label: "Usuarios",
    description: "Todas las cuentas: rol, unidad, teléfono y si aceptó WhatsApp.",
    access: "admin",
    ranged: false,
    columns: [
      { header: "Nombre", width: 28 },
      { header: "Correo", width: 32 },
      { header: "Rol", width: 16 },
      { header: "Unidad", width: 22 },
      { header: "Teléfono", width: 16 },
      { header: "WhatsApp", width: 11 },
      { header: "Registro", width: 20 },
    ],
    async load(supabase) {
      const rows = await paged<{
        full_name: string; email: string | null; role: string; phone: string | null;
        whatsapp_opt_in: boolean; created_at: string; units: Joined;
      }>((a, b) =>
        supabase
          .from("profiles")
          .select("full_name, email, role, phone, whatsapp_opt_in, created_at, units(tower, number)")
          .order("full_name")
          .order("id")
          .range(a, b),
      );
      return rows.map((r) => [r.full_name, r.email, ROLE[r.role] ?? r.role, unit(r.units), r.phone, yesNo(r.whatsapp_opt_in), when(r.created_at)]);
    },
  },
  {
    key: "paquetes",
    label: "Paquetes",
    description: "Paquetes recibidos en el rango: unidad, mensajero, estado y entrega.",
    access: "admin",
    ranged: true,
    columns: [
      { header: "Recibido", width: 20 },
      { header: "Unidad", width: 22 },
      { header: "Mensajero", width: 20 },
      { header: "Destinatario", width: 24 },
      { header: "Descripción", width: 30 },
      { header: "Estado", width: 14 },
      { header: "Entregado", width: 20 },
      { header: "Recibió", width: 22 },
    ],
    async load(supabase, range) {
      const rows = await paged<{
        received_at: string; carrier: string | null; recipient_name: string | null; description: string | null;
        status: string; delivered_at: string | null; delivered_to: string | null; units: Joined;
      }>((a, b) =>
        supabase
          .from("packages")
          .select("received_at, carrier, recipient_name, description, status, delivered_at, delivered_to, units(tower, number)")
          .gte("received_at", range.fromIso)
          .lt("received_at", range.toIso)
          .order("received_at")
          .order("id")
          .range(a, b),
      );
      return rows.map((r) => [
        when(r.received_at), unit(r.units), r.carrier, r.recipient_name, r.description,
        PKG_STATUS[r.status] ?? r.status, when(r.delivered_at), r.delivered_to,
      ]);
    },
  },
  {
    key: "reservas",
    label: "Reservas",
    description: "Reservas de zonas comunes que empiezan en el rango.",
    access: "admin",
    ranged: true,
    columns: [
      { header: "Zona", width: 22 },
      { header: "Unidad", width: 22 },
      { header: "Inicio", width: 20 },
      { header: "Fin", width: 20 },
      { header: "Estado", width: 14 },
      { header: "Notas", width: 34 },
    ],
    async load(supabase, range) {
      const rows = await paged<{
        starts_at: string; ends_at: string; status: string; notes: string | null;
        amenities: { name: string } | null; units: Joined;
      }>((a, b) =>
        supabase
          .from("reservations")
          .select("starts_at, ends_at, status, notes, amenities(name), units(tower, number)")
          .gte("starts_at", range.fromIso)
          .lt("starts_at", range.toIso)
          .order("starts_at")
          .order("id")
          .range(a, b),
      );
      return rows.map((r) => [r.amenities?.name ?? "", unit(r.units), when(r.starts_at), when(r.ends_at), RES_STATUS[r.status] ?? r.status, r.notes]);
    },
  },
  {
    key: "accesos",
    label: "Bitácora de vehículos",
    description: "Ingresos y salidas de vehículos (voz o manual), con los intentos rechazados y los anulados.",
    access: "staff",
    ranged: true,
    columns: [
      { header: "Fecha y hora", width: 20 },
      { header: "Placa", width: 11 },
      { header: "Movimiento", width: 12 },
      { header: "Resultado", width: 15 },
      { header: "Unidad", width: 22 },
      { header: "Medio", width: 10 },
      { header: "Anulado", width: 10 },
    ],
    async load(supabase, range) {
      const rows = await paged<{
        at: string; plate: string; direction: string; result: string; method: string;
        voided_at: string | null; units: Joined;
      }>((a, b) =>
        supabase
          .from("vehicle_access_log")
          .select("at, plate, direction, result, method, voided_at, units(tower, number)")
          .gte("at", range.fromIso)
          .lt("at", range.toIso)
          .order("at")
          .order("id")
          .range(a, b),
      );
      return rows.map((r) => [
        when(r.at), r.plate, r.direction === "ingreso" ? "Ingreso" : "Salida", RESULT[r.result] ?? r.result,
        unit(r.units), r.method === "voz" ? "Voz" : "Manual", r.voided_at ? "Sí" : "",
      ]);
    },
  },
  {
    key: "visitas",
    label: "Visitas",
    description: "Visitantes y permisos temporales de vehículo creados en el rango (sin documentos).",
    access: "staff",
    ranged: true,
    columns: [
      { header: "Visitante", width: 26 },
      { header: "Tipo", width: 14 },
      { header: "Unidad", width: 22 },
      { header: "Placa", width: 11 },
      { header: "Estado", width: 14 },
      { header: "Válida desde", width: 20 },
      { header: "Válida hasta", width: 20 },
      { header: "Ingresó", width: 20 },
      { header: "Salió", width: 20 },
      { header: "Origen", width: 12 },
    ],
    async load(supabase, range) {
      const rows = await paged<{
        visitor_name: string; kind: string; plate: string | null; status: string; valid_from: string; valid_until: string;
        checked_in_at: string | null; checked_out_at: string | null; source: string; units: Joined;
      }>((a, b) =>
        supabase
          .from("visits")
          .select("visitor_name, kind, plate, status, valid_from, valid_until, checked_in_at, checked_out_at, source, units(tower, number)")
          .gte("created_at", range.fromIso)
          .lt("created_at", range.toIso)
          .order("created_at")
          .order("id")
          .range(a, b),
      );
      return rows.map((r) => [
        r.visitor_name, KIND[r.kind] ?? r.kind, unit(r.units), r.plate, VISIT_STATUS[r.status] ?? r.status,
        when(r.valid_from), when(r.valid_until), when(r.checked_in_at), when(r.checked_out_at),
        r.source === "porteria" ? "Portería" : "Residente",
      ]);
    },
  },
  {
    key: "votaciones",
    label: "Resultados de votaciones",
    description: "Una fila por opción: votos, porcentaje y participación de cada votación creada en el rango.",
    access: "admin",
    ranged: true,
    columns: [
      { header: "Asamblea", width: 26 },
      { header: "Pregunta", width: 40 },
      { header: "Voto", width: 11 },
      { header: "Estado", width: 11 },
      { header: "Opción", width: 24 },
      { header: "Votos", width: 9 },
      { header: "% de votos", width: 11 },
      { header: "Participación", width: 22 },
    ],
    async load(supabase, range) {
      const { data } = await supabase
        .from("polls")
        .select("id, question, mode, status, closes_at, assemblies(title), poll_options(id, label, position)")
        .gte("created_at", range.fromIso)
        .lt("created_at", range.toIso)
        .order("created_at")
        .limit(300);
      const polls = (data ?? []) as unknown as {
        id: string; question: string; mode: string; status: string; closes_at: string | null;
        assemblies: { title: string } | null; poll_options: { id: string; label: string; position: number }[];
      }[];

      const rows: Cell[][] = [];
      await Promise.all(
        polls.map(async (p) => {
          const [res, part] = await Promise.all([
            supabase.rpc("poll_results", { p_poll: p.id }),
            supabase.rpc("poll_participation", { p_poll: p.id }),
          ]);
          const votes = new Map((res.data ?? []).map((v) => [v.option_id, Number(v.votes)]));
          const totalVotes = [...votes.values()].reduce((a, b) => a + b, 0);
          const voted = Number(part.data?.[0]?.voted ?? 0);
          const total = Number(part.data?.[0]?.total ?? 0);
          const open = p.status === "abierta" && (!p.closes_at || Date.parse(p.closes_at) > Date.now());
          for (const o of [...p.poll_options].sort((a, b) => a.position - b.position)) {
            const n = votes.get(o.id) ?? 0;
            rows.push([
              p.assemblies?.title ?? "", p.question, p.mode === "nominal" ? "Nominal" : "Secreto", open ? "Abierta" : "Cerrada",
              o.label, n, totalVotes ? `${Math.round((n / totalVotes) * 100)}%` : "0%", `${voted} de ${total} unidades`,
            ]);
          }
        }),
      );
      // Promise.all termina en cualquier orden: se ordena por asamblea y pregunta para que el archivo sea estable.
      return rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
    },
  },
  {
    key: "comunicados",
    label: "Lectura de comunicados",
    description: "Comunicados publicados en el rango: destinatarios, lectores y porcentaje de lectura.",
    access: "admin",
    ranged: true,
    columns: [
      { header: "Título", width: 40 },
      { header: "Dirigido a", width: 18 },
      { header: "Publicado", width: 20 },
      { header: "Editado", width: 20 },
      { header: "Destinatarios", width: 14 },
      { header: "Lectores", width: 11 },
      { header: "% de lectura", width: 13 },
    ],
    async load(supabase, range) {
      const { data } = await supabase.rpc("export_announcement_reads", { p_from: range.fromIso, p_to: range.toIso });
      return (data ?? []).map((r) => {
        const recipients = Number(r.recipients);
        const readers = Number(r.readers);
        return [
          r.title,
          r.audience === "torre" ? (r.tower ?? "Torre") : "Todo el conjunto",
          when(r.published_at),
          when(r.edited_at),
          recipients,
          readers,
          recipients ? `${Math.min(100, Math.round((readers / recipients) * 100))}%` : "0%",
        ];
      });
    },
  },
];

export const findDataset = (key: string) => DATASETS.find((d) => d.key === key);
