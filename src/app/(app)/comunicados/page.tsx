import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import {
  Badge,
  Card,
  ContentSkeleton,
  Empty,
  Field,
  PageHeader,
  Select,
  btnGhost,
  btnSm,
  inputCls,
} from "@/components/ui";
import { getProfile, isAdmin, unitLabel } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { markAsRead, publishAnnouncement } from "./actions";

export const metadata: Metadata = { title: "Comunicados" };

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "todos" | "torre";
  tower: string | null;
  pinned: boolean;
  published_at: string;
};

type Resident = {
  id: string;
  full_name: string;
  email: string | null;
  units: { tower: string; number: string } | null;
};

/** Acuse de lectura (solo administración): quién leyó y quién falta entre los destinatarios. */
function ReadReceipts({
  announcement,
  residents,
  reads,
}: {
  announcement: Announcement;
  residents: Resident[];
  reads?: Map<string, string>;
}) {
  const audience = residents.filter(
    (r) => announcement.audience === "todos" || r.units?.tower === announcement.tower,
  );
  const readers = audience.filter((r) => reads?.has(r.id));
  const pending = audience.filter((r) => !reads?.has(r.id));
  const pct = audience.length ? Math.round((readers.length / audience.length) * 100) : 0;
  const name = (r: Resident) => r.full_name || r.email || "Sin nombre";

  return (
    <details className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
          <span>
            Leído por {readers.length} de {audience.length} destinatarios
          </span>
          <span className="text-primary-ink">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </summary>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-success">
            Leyeron ({readers.length})
          </p>
          {readers.length === 0 ? (
            <p className="text-sm text-muted">Nadie aún.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {readers.map((r) => (
                <li key={r.id}>
                  <span className="font-medium text-ink">{name(r)}</span>
                  <span className="block text-xs text-muted">
                    {unitLabel(r.units)} · {fmtDateTime(reads!.get(r.id)!)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
            Pendientes ({pending.length})
          </p>
          {pending.length === 0 ? (
            <p className="text-sm text-muted">Todos leyeron.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {pending.map((r) => (
                <li key={r.id}>
                  <span className="font-medium text-ink">{name(r)}</span>
                  <span className="block text-xs text-muted">{unitLabel(r.units)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}

export default function ComunicadosPage() {
  return (
    <>
      <PageHeader
        title="Comunicados"
        description="Avisos de la administración para todo el conjunto o para tu torre."
        action={
          <Suspense fallback={null}>
            <NewAnnouncement />
          </Suspense>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <ComunicadosContent />
      </Suspense>
    </>
  );
}

async function ComunicadosContent() {
  const profile = await getProfile();
  const admin = isAdmin(profile);
  const supabase = await createClient();

  const [listRes, readsRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, audience, tower, pinned, published_at")
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(30),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", profile.id),
  ]);

  const items = (listRes.data ?? []) as Announcement[];
  const read = new Set((readsRes.data ?? []).map((r) => r.announcement_id as string));

  // Solo administración: quién leyó cada comunicado (entre los residentes a quienes va dirigido).
  let residents: Resident[] = [];
  const readsByAnnouncement = new Map<string, Map<string, string>>();
  if (admin && items.length > 0) {
    const [residentsRes, receiptsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, units(tower, number)")
        .eq("role", "residente")
        .order("full_name"),
      supabase
        .from("announcement_reads")
        .select("announcement_id, user_id, read_at")
        .in("announcement_id", items.map((i) => i.id)),
    ]);
    residents = (residentsRes.data ?? []) as unknown as Resident[];
    for (const r of receiptsRes.data ?? []) {
      const byUser = readsByAnnouncement.get(r.announcement_id) ?? new Map<string, string>();
      byUser.set(r.user_id, r.read_at);
      readsByAnnouncement.set(r.announcement_id, byUser);
    }
  }

  return (
    <>
      <div>
        <div className="space-y-4">
          {items.length === 0 ? (
            <Card>
              <Empty>No hay comunicados todavía.</Empty>
            </Card>
          ) : (
            items.map((a) => {
              const isRead = read.has(a.id);
              return (
                <Card key={a.id} className={!isRead && !admin ? "border-l-4 !border-l-accent" : ""}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-ink">{a.title}</h2>
                    <div className="flex gap-1.5">
                      {a.pinned && <Badge tone="accent">Fijado</Badge>}
                      <Badge tone={a.audience === "torre" ? "primary" : "neutral"}>
                        {a.audience === "torre" ? `Torre ${a.tower}` : "Todo el conjunto"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{fmtDateTime(a.published_at)}</p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink">{a.body}</p>
                  {admin && <ReadReceipts announcement={a} residents={residents} reads={readsByAnnouncement.get(a.id)} />}
                  {!admin && (
                    <div className="mt-4">
                      {isRead ? (
                        <Badge tone="success">Leído</Badge>
                      ) : (
                        <form action={markAsRead}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className={`${btnGhost} ${btnSm}`}>
                            Marcar como leído
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

/** Botón + modal para publicar: solo administración. */
async function NewAnnouncement() {
  const profile = await getProfile();
  if (!isAdmin(profile)) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("units").select("tower");
  const towers = [...new Set((data ?? []).map((u) => u.tower as string).filter(Boolean))].sort();

  return (
    <Modal
      title="Nuevo comunicado"
      description="Los residentes lo verán en su panel y podrás seguir quién lo leyó."
      icon="megaphone"
      trigger="Nuevo comunicado"
      plus
      size="lg"
    >
      <ActionForm action={publishAnnouncement} submitLabel="Publicar" pendingLabel="Publicando…" variant="accent">
        <Field label="Título">
          <input name="title" required placeholder="Corte de agua programado" className={inputCls} autoFocus />
        </Field>
        <Field label="Mensaje">
          <textarea name="body" rows={7} required className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dirigido a">
            <Select name="audience" defaultValue="todos">
              <option value="todos">Todo el conjunto</option>
              <option value="torre">Una torre</option>
            </Select>
          </Field>
          <Field label="Torre (si va a una sola)">
            <Select name="tower" defaultValue="">
              <option value="">—</option>
              {towers.map((t) => (
                <option key={t} value={t}>
                  Torre {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="pinned" className="size-4 accent-[var(--primary)]" />
          Fijar arriba de los demás comunicados
        </label>
      </ActionForm>
    </Modal>
  );
}
