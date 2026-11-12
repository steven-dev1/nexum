import { AttachmentsField } from "@/components/attachments-field";
import { DatePicker } from "@/components/date-picker";
import { Select } from "@/components/select";
import { TimePicker } from "@/components/time-picker";
import { Field, inputCls, labelCls } from "@/components/ui";
import type { AttachmentView } from "@/lib/attachments";
import { todayBogota } from "@/lib/format";
import { REMINDERS, type ReminderKey } from "./reminders";

export type AssemblyDefaults = {
  title?: string;
  kind?: string;
  date?: string;
  time?: string;
  location?: string;
  meetingUrl?: string;
  description?: string;
  status?: string;
  reminders?: ReminderKey[];
  attachments?: AttachmentView[];
};

/** Campos de una asamblea (convocar o editar). Al editar se agrega el estado. */
export function AssemblyFields({ defaults = {}, editing = false }: { defaults?: AssemblyDefaults; editing?: boolean }) {
  const reminders = defaults.reminders ?? (["7d", "1d"] as ReminderKey[]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Título">
          <input
            name="title"
            required
            defaultValue={defaults.title}
            placeholder="Asamblea general ordinaria 2027"
            className={inputCls}
            autoFocus
          />
        </Field>
        <Select
          label="Tipo"
          name="kind"
          required
          defaultValue={defaults.kind ?? "ordinaria"}
          options={[
            { value: "ordinaria", label: "Ordinaria", hint: "La reunión anual obligatoria" },
            { value: "extraordinaria", label: "Extraordinaria", hint: "Para asuntos urgentes o puntuales" },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <div>
          <span className={labelCls}>Fecha</span>
          <DatePicker name="date" min={todayBogota()} required defaultValue={defaults.date} />
        </div>
        <div>
          <span className={labelCls}>Hora</span>
          <TimePicker name="time" required step={15} defaultValue={defaults.time} />
        </div>
      </div>

      {editing && (
        <Select
          label="Estado"
          name="status"
          required
          defaultValue={defaults.status ?? "programada"}
          options={[
            { value: "programada", label: "Programada", hint: "Aún no se realiza" },
            { value: "en_curso", label: "En curso", hint: "Se está realizando ahora" },
            { value: "finalizada", label: "Finalizada", hint: "Ya se realizó" },
            { value: "cancelada", label: "Cancelada", hint: "No se realizará" },
          ]}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lugar">
          <input name="location" defaultValue={defaults.location} placeholder="Salón social" className={inputCls} />
        </Field>
        <Field label="Enlace virtual (opcional)">
          <input
            type="url"
            name="meeting_url"
            defaultValue={defaults.meetingUrl}
            placeholder="https://…"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Orden del día / descripción">
        <textarea name="description" rows={4} defaultValue={defaults.description} className={inputCls} />
      </Field>

      <AttachmentsField existing={defaults.attachments} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Recordatorios</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REMINDERS) as ReminderKey[]).map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-ink"
            >
              <input
                type="checkbox"
                name="reminders"
                value={key}
                defaultChecked={reminders.includes(key)}
                className="size-4 accent-[var(--primary)]"
              />
              {REMINDERS[key].option}
            </label>
          ))}
        </div>
        {editing && (
          <p className="mt-2 text-xs leading-5 text-muted">
            Al guardar se reprograman los recordatorios que aún no se han enviado según la nueva fecha. Si la asamblea
            no queda «Programada», se quitan.
          </p>
        )}
      </fieldset>
    </>
  );
}
