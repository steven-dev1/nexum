import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import {
  Badge,
  Card,
  Empty,
  Field,
  PageHeader,
  SectionTitle,
  btnGhost,
  btnSm,
  inputCls,
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

export default async function AsambleasPage() {
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
    <>
      <PageHeader
        title="Asambleas y recordatorios"
        description="Convocatorias del conjunto y los avisos programados para no perderte ninguna."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
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
                    {a.description && <p className="mt-2 text-sm text-muted">{a.description}</p>}
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

        {admin && (
          <Card className="h-fit lg:sticky lg:top-8">
            <SectionTitle>Convocar asamblea</SectionTitle>
            <ActionForm action={createAssembly} submitLabel="Convocar" variant="accent">
              <Field label="Título">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Tipo">
                <select name="kind" defaultValue="ordinaria" className={inputCls}>
                  <option value="ordinaria">Ordinaria</option>
                  <option value="extraordinaria">Extraordinaria</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha">
                  <input type="date" name="date" min={todayBogota()} required className={inputCls} />
                </Field>
                <Field label="Hora">
                  <input type="time" name="time" required className={inputCls} />
                </Field>
              </div>
              <Field label="Lugar">
                <input name="location" placeholder="Salón social" className={inputCls} />
              </Field>
              <Field label="Enlace de reunión virtual (opcional)">
                <input type="url" name="meeting_url" placeholder="https://…" className={inputCls} />
              </Field>
              <Field label="Orden del día / descripción">
                <textarea name="description" rows={3} className={inputCls} />
              </Field>
              <fieldset>
                <legend className="mb-1 text-sm font-medium text-ink">Recordatorios</legend>
                <div className="space-y-1.5 text-sm text-ink">
                  {[
                    ["7d", "7 días antes"],
                    ["1d", "1 día antes"],
                    ["1h", "1 hora antes"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2">
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
          </Card>
        )}
      </div>
    </>
  );
}
