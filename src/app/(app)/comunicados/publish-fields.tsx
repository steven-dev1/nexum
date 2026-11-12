"use client";

import { useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Select } from "@/components/select";
import { TimePicker } from "@/components/time-picker";
import { labelCls } from "@/components/ui";
import { todayBogota } from "@/lib/format";

export type PublishMode = "ahora" | "programar" | "borrador";

/** Cuándo se publica el comunicado: ahora, a una hora programada o guardarlo como borrador. */
export function PublishFields({
  defaultMode = "ahora",
  defaultDate,
  defaultTime,
}: {
  defaultMode?: PublishMode;
  defaultDate?: string;
  defaultTime?: string;
}) {
  const [mode, setMode] = useState<PublishMode>(defaultMode);

  return (
    <div className="space-y-4">
      <Select
        label="Publicación"
        name="publish"
        required
        value={mode}
        onChange={(v) => setMode(v as PublishMode)}
        options={[
          { value: "ahora", label: "Publicar ahora", hint: "Los residentes lo ven y reciben el aviso de inmediato" },
          { value: "programar", label: "Programar", hint: "Se publica y se avisa a la fecha y hora que elijas" },
          { value: "borrador", label: "Guardar como borrador", hint: "Solo la administración lo ve" },
        ]}
      />
      {mode === "programar" && (
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div>
            <span className={labelCls}>Fecha de publicación</span>
            <DatePicker name="publish_date" min={todayBogota()} required defaultValue={defaultDate} />
          </div>
          <div>
            <span className={labelCls}>Hora</span>
            <TimePicker name="publish_time" required step={15} defaultValue={defaultTime} />
          </div>
        </div>
      )}
    </div>
  );
}
