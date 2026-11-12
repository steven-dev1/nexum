import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Badge, Card, ContentSkeleton, Empty, PageHeader, btnDanger, btnGhost, btnSm } from "@/components/ui";
import { getProfile, isAdmin, unitLabel } from "@/lib/auth";
import { AttachmentLinks } from "@/components/attachment-links";
import { signAttachmentUrls, type AttachmentView } from "@/lib/attachments";
import { RichText } from "@/components/rich-text";
import { docFromPlain, imagePathsOf, IMAGE_BUCKET, type RichNode } from "@/lib/rich-text";
import { bogotaDateTime, fmtDateTime } from "@/lib/format";
import { groupName } from "@/lib/units";
import { createClient } from "@/lib/supabase/server";
import { deleteAnnouncement, markAsRead, publishAnnouncement, updateAnnouncement } from "./actions";
import { AnnouncementFields, towersOf } from "./announcement-fields";

export const metadata: Metadata = { title: "Comunicados" };

type Announcement = {
  id: string;
  title: string;
  body: string;
  content: RichNode | null;
  edited_at: string | null;
  draft: boolean;
  attachments: AttachmentView[];
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
  const audience = residents.filter((r) => announcement.audience === "todos" || r.units?.tower === announcement.tower);
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

  const [listRes, readsRes, unitsRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, content, edited_at, draft, audience, tower, pinned, published_at, attachments(id, name, size_bytes, file_path)")
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(30),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", profile.id),
    admin ? supabase.from("units").select("tower") : Promise.resolve({ data: [] as { tower: string }[] }),
  ]);
  const towers = towersOf(unitsRes.data);

  const items = (listRes.data ?? []) as unknown as Announcement[];
  const nowMs = new Date().getTime();
  /** Borrador, programado o ya publicado (solo la administración ve los dos primeros). */
  const stateOf = (a: Announcement) => (a.draft ? "borrador" : Date.parse(a.published_at) > nowMs ? "programado" : "publicado");

  const attachmentUrls = await signAttachmentUrls(
    supabase,
    items.flatMap((i) => i.attachments),
  );

  // URLs firmadas (1 h) de las imágenes de los comunicados visibles.
  const imageUrls: Record<string, string> = {};
  const paths = [...new Set(items.flatMap((i) => imagePathsOf(i.content)))];
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) imageUrls[s.path] = s.signedUrl;
  }
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
        .in(
          "announcement_id",
          items.map((i) => i.id),
        ),
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
              const state = stateOf(a);
              const isRead = read.has(a.id);
              return (
                <Card key={a.id} className={!isRead && !admin ? "border-l-4 !border-l-accent" : ""}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-ink">{a.title}</h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {admin && <EditAnnouncement announcement={a} towers={towers} imageUrls={imageUrls} />}
                      {admin && <DeleteAnnouncement announcement={a} />}
                      {state === "borrador" && <Badge tone="neutral">Borrador</Badge>}
                      {state === "programado" && <Badge tone="primary">Programado</Badge>}
                      {a.pinned && <Badge tone="accent">Fijado</Badge>}
                      <Badge tone={a.audience === "torre" ? "primary" : "neutral"}>
                        {a.audience === "torre" ? groupName(a.tower) : "Todo el conjunto"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {state === "borrador"
                      ? "Borrador · sin publicar"
                      : state === "programado"
                        ? `Se publica el ${fmtDateTime(a.published_at)}`
                        : fmtDateTime(a.published_at)}
                    {a.edited_at && <span title={fmtDateTime(a.edited_at)}> · Editado</span>}
                  </p>
                  <div className="mt-3">
                    {a.content ? (
                      <RichText doc={a.content} urls={imageUrls} />
                    ) : (
                      <p className="whitespace-pre-line text-sm leading-6 text-ink">{a.body}</p>
                    )}
                    <AttachmentLinks items={a.attachments} urls={attachmentUrls} />
                  </div>
                  {admin && state === "publicado" && (
                    <ReadReceipts announcement={a} residents={residents} reads={readsByAnnouncement.get(a.id)} />
                  )}
                  {!admin && state === "publicado" && (
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

/** Opciones de publicación al editar: un comunicado ya publicado no vuelve a ser borrador. */
function editPublish(a: Announcement) {
  if (!a.draft && Date.parse(a.published_at) <= Date.now()) return null;
  if (a.draft) return { mode: "borrador" as const };
  const { date, time } = bogotaDateTime(a.published_at);
  return { mode: "programar" as const, date, time };
}

/** Botón + modal para editar un comunicado (solo administración). */
function EditAnnouncement({
  announcement: a,
  towers,
  imageUrls,
}: {
  announcement: Announcement;
  towers: string[];
  imageUrls: Record<string, string>;
}) {
  return (
    <Modal
      title="Editar comunicado"
      description="Los cambios se ven de inmediato; las lecturas registradas se conservan."
      icon="edit"
      trigger="Editar"
      triggerClassName={`${btnGhost} ${btnSm}`}
      size="lg"
    >
      <ActionForm action={updateAnnouncement} submitLabel="Guardar cambios" pendingLabel="Guardando…">
        <input type="hidden" name="id" value={a.id} />
        <AnnouncementFields
          towers={towers}
          defaults={{
            title: a.title,
            doc: a.content ?? docFromPlain(a.body),
            imageUrls,
            attachments: a.attachments,
            publish: editPublish(a),
            target: a.audience === "torre" ? `torre:${a.tower}` : "todos",
            pinned: a.pinned,
          }}
        />
      </ActionForm>
    </Modal>
  );
}

/** Botón + modal para eliminar un comunicado (solo administración). */
function DeleteAnnouncement({ announcement: a }: { announcement: Announcement }) {
  return (
    <Modal
      title="Eliminar comunicado"
      description={`«${a.title}»`}
      trigger="Eliminar"
      triggerClassName={`${btnGhost} ${btnSm}`}
    >
      <ActionForm
        action={deleteAnnouncement}
        submitLabel="Eliminar"
        pendingLabel="Eliminando…"
        buttonClassName={btnDanger}
      >
        <input type="hidden" name="id" value={a.id} />
        <p className="text-sm text-muted">
          Se borra para todos los destinatarios y se pierde el registro de quién lo leyó. Esta acción no se puede
          deshacer.
        </p>
      </ActionForm>
    </Modal>
  );
}

/** Botón + modal para publicar: solo administración. */
async function NewAnnouncement() {
  const profile = await getProfile();
  if (!isAdmin(profile)) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("units").select("tower");
  const towers = towersOf(data);

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
        <AnnouncementFields towers={towers} />
      </ActionForm>
    </Modal>
  );
}
