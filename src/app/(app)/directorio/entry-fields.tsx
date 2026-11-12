import { Select } from "@/components/select";
import { Field, inputCls } from "@/components/ui";

export const CATEGORY_LABEL: Record<string, string> = {
  emergencia: "Emergencias",
  administracion: "Administración y portería",
  proveedor: "Proveedores",
  servicio: "Servicios del conjunto",
  otro: "Otros",
};

export type EntryDefaults = {
  name?: string;
  category?: string;
  phone?: string;
  hasWhatsapp?: boolean;
  description?: string;
  schedule?: string;
};

/** Campos de un contacto del directorio (crear o editar). */
export function EntryFields({ defaults = {} }: { defaults?: EntryDefaults }) {
  return (
    <>
      <Field label="Nombre">
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={defaults.name}
          placeholder="Plomero · Carlos Pérez"
          className={inputCls}
          autoFocus
        />
      </Field>
      <Select
        label="Categoría"
        name="category"
        required
        defaultValue={defaults.category ?? "proveedor"}
        options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono">
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={40}
            defaultValue={defaults.phone}
            placeholder="3001234567"
            className={inputCls}
          />
        </Field>
        <Field label="Horario (opcional)">
          <input name="schedule" maxLength={120} defaultValue={defaults.schedule} placeholder="Lun–Sáb 8am–6pm" className={inputCls} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="has_whatsapp"
          defaultChecked={defaults.hasWhatsapp}
          className="size-4 accent-[var(--primary)]"
        />
        Este número tiene WhatsApp (muestra el botón para escribir)
      </label>
      <Field label="Detalle (opcional)">
        <textarea name="description" rows={3} maxLength={500} defaultValue={defaults.description} className={inputCls} />
      </Field>
    </>
  );
}
