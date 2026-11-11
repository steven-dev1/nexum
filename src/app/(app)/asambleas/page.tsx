import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { DatePicker } from "@/components/date-picker";
import { Modal } from "@/components/modal";
import { TimePicker } from "@/components/time-picker";
import {
  Badge,
  Card,
  ContentSkeleton,
  Empty,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  btnGhost,
  btnSm,
  inputCls,
  labelCls,
} from "@/components/ui";
import { getProfile, isAdmin } from "@/lib/auth";
import { fmtDateTime, todayBogota } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cancelAssembly, createAssembly } from "./actions";

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
  assembly_reminders: { id: string; remind_at: string }[];
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
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Título">
            <input name="title" required placeholder="Asamblea general ordinaria 2027" className={inputCls} autoFocus />
          </Field>
          <Field label="Tipo">
            <Select name="kind" defaultValue="ordinaria">
              <option value="ordinaria">Ordinaria</option>
              <option value="extraordinaria">Extraordinaria</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div>
            <span className={labelCls}>Fecha</span>
            <DatePicker name="date" min={todayBogota()} required />
          </div>
          <div>
            <span className={labelCls}>Hora</span>
            <TimePicker name="time" required step={15} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lugar">
            <input name="location" placeholder="Salón social" className={inputCls} />
          </Field>
          <Field label="Enlace virtual (opcional)">
            <input type="url" name="meeting_url" placeholder="https://…" className={inputCls} />
          </Field>
        </div>
        <Field label="Orden del día / descripción">
          <textarea name="description" rows={4} className={inputCls} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Recordatorios</legend>
          <div className="flex flex-wrap gap-2">
            {[
              ["7d", "7 días antes"],
              ["1d", "1 día antes"],
              ["1h", "1 hora antes"],
            ].map(([value, label]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-ink"
              >
                <input
                  type="checkbox"
                  name="reminders"
                  value={value}
                  defaultChecked={value !== "1h"}
                  className="size-4 accent-[var(--primary)]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
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
    "id, title, description, kind, scheduled_at, location, meeting_url, status, assembly_reminders(id, remind_at)";

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

  const upcoming = (upcomingRes.data ?? []) as Assembly[];
  const past = (pastRes.data ?? []) as Assembly[];

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
                {admin && a.status === "programada" && (
                  <form action={cancelAssembly} className="mt-3">
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className={`${btnGhost} ${btnSm}`}>
                      Cancelar asamblea
                    </button>
                  </form>
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
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{a.title}</p>
                  <p className="text-xs text-muted">{fmtDateTime(a.scheduled_at)}</p>
                </div>
                <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
