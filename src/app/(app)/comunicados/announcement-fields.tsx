import { Select } from "@/components/select";
import { Field, inputCls } from "@/components/ui";
import { groupName } from "@/lib/units";

export type AnnouncementDefaults = {
  title?: string;
  body?: string;
  /** "todos" o "torre:<torre>" */
  target?: string;
  pinned?: boolean;
};

/** Campos de un comunicado (publicar o editar). */
export function AnnouncementFields({ towers, defaults = {} }: { towers: string[]; defaults?: AnnouncementDefaults }) {
  return (
    <>
      <Field label="Título">
        <input
          name="title"
          required
          defaultValue={defaults.title}
          placeholder="Corte de agua programado"
          className={inputCls}
          autoFocus
        />
      </Field>
      <Field label="Mensaje">
        <textarea name="body" rows={7} required defaultValue={defaults.body} className={inputCls} />
      </Field>
      <Select
        label="Dirigido a"
        name="target"
        required
        defaultValue={defaults.target ?? "todos"}
        options={[
          { value: "todos", label: "Todo el conjunto", hint: "Lo ven todos los residentes" },
          ...towers.map((t) => ({
            value: `torre:${t}`,
            label: `Solo ${groupName(t)}`,
            hint: "Lo ven únicamente los residentes de esa torre",
            group: "Por torre",
          })),
        ]}
      />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="pinned"
          defaultChecked={defaults.pinned}
          className="size-4 accent-[var(--primary)]"
        />
        Fijar arriba de los demás comunicados
      </label>
    </>
  );
}

/** Torres existentes, para el desplegable "Dirigido a". */
export function towersOf(units: { tower: string | null }[] | null) {
  return [...new Set((units ?? []).map((u) => u.tower ?? "").filter(Boolean))].sort();
}
