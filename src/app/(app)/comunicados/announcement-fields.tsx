import { AttachmentsField } from "@/components/attachments-field";
import { RichEditor } from "@/components/rich-editor";
import { Select } from "@/components/select";
import { Field, inputCls } from "@/components/ui";
import type { AttachmentView } from "@/lib/attachments";
import type { RichNode } from "@/lib/rich-text";
import { groupName } from "@/lib/units";

export type AnnouncementDefaults = {
  title?: string;
  /** Documento con formato (o el texto plano de un comunicado antiguo, ya convertido). */
  doc?: RichNode | null;
  imageUrls?: Record<string, string>;
  attachments?: AttachmentView[];
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
      <RichEditor name="content" initialDoc={defaults.doc} imageUrls={defaults.imageUrls} />
      <AttachmentsField existing={defaults.attachments} />
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
