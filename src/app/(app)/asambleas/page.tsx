import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Badge, Card, ContentSkeleton, Empty, PageHeader, SectionTitle, btnGhost, btnSm } from "@/components/ui";
import { getProfile, isAdmin } from "@/lib/auth";
import { bogotaDateTime, fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { AttachmentLinks } from "@/components/attachment-links";
import { signAttachmentUrls, type AttachmentView } from "@/lib/attachments";
import { cancelAssembly, createAssembly, updateAssembly } from "./actions";
import { AssemblyFields } from "./assembly-fields";
import { reminderKeysFor } from "./reminders";
import { PollsSection, loadPolls } from "./polls-section";

export const metadata: Metadata = { title: "Asambleas" };

type Assembly = {
  id: string;
  title: string;
  description: string | null;
  kind: "ordinaria" | "extraordinaria";
  scheduled_at: string;
  location: string | null;
  meeting_url: string | null;
  status: "programada" | "en_curso" | "finalizada" | "cancelada";
  assembly_reminders: { id: string; remind_at: string; sent_at: string | null }[];
  attachments: AttachmentView[];
};

const statusTone = {
  programada: "primary",
  en_curso: "success",
  finalizada: "neutral",
  cancelada: "danger",
} as const;

const statusLabel = {
  programada: "Programada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
} as const;

export default function AsambleasPage() {
  return (
    <>
      <PageHeader
        title="Asambleas y recordatorios"
        description="Convocatorias del conjunto y los avisos programados para no perderte ninguna."
        action={
          <Suspense fallback={null}>
            <NewAssembly />
          </Suspense>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <AsambleasContent />
      </Suspense>
    </>
  );
}

/** Botón + modal para convocar: solo administración. */
async function NewAssembly() {
  const profile = await getProfile();
  if (!isAdmin(profile)) return null;

  return (
    <Modal
      title="Convocar asamblea"
      description="Se publica para todos los residentes con los recordatorios que elijas."
      icon="users"
      trigger="Convocar asamblea"
      plus
      size="lg"
    >
      <ActionForm action={createAssembly} submitLabel="Convocar" pendingLabel="Convocando…" variant="accent">
        <AssemblyFields />
      </ActionForm>
    </Modal>
  );
}

/** Botón + modal para editar una asamblea (solo administración). */
function EditAssembly({ assembly: a }: { assembly: Assembly }) {
  const { date, time } = bogotaDateTime(a.scheduled_at);
  return (
    <Modal
      title="Editar asamblea"
      description={a.title}
      icon="edit"
      trigger="Editar"
      triggerClassName={`${btnGhost} ${btnSm}`}
      size="lg"
    >
      <ActionForm action={updateAssembly} submitLabel="Guardar cambios" pendingLabel="Guardando…">
        <input type="hidden" name="id" value={a.id} />
        <AssemblyFields
          editing
          defaults={{
            title: a.title,
            kind: a.kind,
            date,
            time,
            location: a.location ?? "",
            meetingUrl: a.meeting_url ?? "",
            description: a.description ?? "",
            status: a.status,
            reminders: reminderKeysFor(a.scheduled_at, a.assembly_reminders),
            attachments: a.attachments,
          }}
        />
      </ActionForm>
    </Modal>
  );
}

async function AsambleasContent() {
  const profile = await getProfile();
  const admin = isAdmin(profile);
  const supabase = await createClient();

  // Una asamblea sigue "próxima" hasta 6 h después de su hora de inicio.
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 6);
  const cutoffIso = cutoff.toISOString();
  const columns =
    "id, title, description, kind, scheduled_at, location, meeting_url, status, assembly_reminders(id, remind_at, sent_at), attachments(id, name, size_bytes, file_path)";

  const [upcomingRes, pastRes] = await Promise.all([
    supabase
      .from("assemblies")
      .select(columns)
      .in("status", ["programada", "en_curso"])
      .gte("scheduled_at", cutoffIso)
      .order("scheduled_at"),
    supabase
      .from("assemblies")
      .select(columns)
      .or(`status.in.(cancelada,finalizada),scheduled_at.lt.${cutoffIso}`)
      .order("scheduled_at", { ascending: false })
      .limit(15),
  ]);

  const upcoming = (upcomingRes.data ?? []) as unknown as Assembly[];
  const past = (pastRes.data ?? []) as unknown as Assembly[];

  const [pollsByAssembly, attachmentUrls] = await Promise.all([
    loadPolls(
      supabase,
      [...upcoming, ...past].map((a) => a.id),
      profile,
      admin,
    ),
    signAttachmentUrls(
      supabase,
      [...upcoming, ...past].flatMap((a) => a.attachments),
    ),
  ]);
  const canVote = profile.role === "residente" && !!profile.unitId;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Próximas</SectionTitle>
        {upcoming.length === 0 ? (
          <Empty>No hay asambleas convocadas.</Empty>
        ) : (
          <ul className="space-y-4">
            {upcoming.map((a) => (
              <li key={a.id} className="rounded-lg border border-line bg-surface-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{a.title}</p>
                    <p className="text-sm text-primary-ink">{fmtDateTime(a.scheduled_at)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge tone={a.kind === "extraordinaria" ? "accent" : "neutral"}>
                      {a.kind === "extraordinaria" ? "Extraordinaria" : "Ordinaria"}
                    </Badge>
                    <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
                  </div>
                </div>
                {a.description && <p className="mt-2 whitespace-pre-line text-sm text-muted">{a.description}</p>}
                <dl className="mt-2 space-y-0.5 text-sm text-muted">
                  {a.location && (
                    <div>
                      <dt className="inline font-medium text-ink">Lugar: </dt>
                      <dd className="inline">{a.location}</dd>
                    </div>
                  )}
                  {a.meeting_url && (
                    <div>
                      <dt className="inline font-medium text-ink">Enlace: </dt>
                      <dd className="inline">
                        <a
                          href={a.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary-ink underline-offset-2 hover:underline"
                        >
                          Unirse a la reunión
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
                {a.assembly_reminders.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    Recordatorios:{" "}
                    {a.assembly_reminders
                      .map((r) => r.remind_at)
                      .sort()
                      .map((d) => fmtDateTime(d))
                      .join(" · ")}
                  </p>
                )}
                <AttachmentLinks items={a.attachments} urls={attachmentUrls} />
                <PollsSection
                  polls={pollsByAssembly.get(a.id) ?? []}
                  assemblyId={a.id}
                  admin={admin}
                  canVote={canVote}
                />
                {admin && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <EditAssembly assembly={a} />
                    {a.status === "programada" && (
                      <form action={cancelAssembly}>
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" className={`${btnGhost} ${btnSm}`}>
                          Cancelar asamblea
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {past.length > 0 && (
        <Card>
          <SectionTitle>Anteriores</SectionTitle>
          <ul className="divide-y divide-line">
            {past.map((a) => (
              <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{a.title}</p>
                    <p className="text-xs text-muted">{fmtDateTime(a.scheduled_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
                    {admin && <EditAssembly assembly={a} />}
                  </div>
                </div>
                <AttachmentLinks items={a.attachments} urls={attachmentUrls} />
                {((pollsByAssembly.get(a.id)?.length ?? 0) > 0 || admin) && (
                  <PollsSection
                    polls={pollsByAssembly.get(a.id) ?? []}
                    assemblyId={a.id}
                    admin={admin}
                    canVote={canVote}
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
