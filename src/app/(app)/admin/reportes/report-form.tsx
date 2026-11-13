"use client";

import { useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Select } from "@/components/select";
import { btnPrimary, labelCls } from "@/components/ui";

export type ReportOption = { key: string; label: string; description: string; ranged: boolean };

/** Elige el reporte, el rango y el formato, y descarga el archivo desde `/api/export/<reporte>`. */
export function ReportForm({ options, defaultFrom, defaultTo }: { options: ReportOption[]; defaultFrom: string; defaultTo: string }) {
  const [dataset, setDataset] = useState(options[0]?.key ?? "");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [format, setFormat] = useState<"xlsx" | "pdf">("xlsx");

  const current = options.find((o) => o.key === dataset);
  const params = new URLSearchParams({ format });
  if (current?.ranged) {
    if (from) params.set("desde", from);
    if (to) params.set("hasta", to);
  }
  const invalid = !!current?.ranged && !!from && !!to && from > to;

  return (
    <div className="space-y-5">
      <Select
        label="Reporte"
        name="dataset"
        value={dataset}
        onChange={setDataset}
        options={options.map((o) => ({ value: o.key, label: o.label, hint: o.description }))}
      />

      {current?.ranged && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Desde</span>
            <DatePicker name="from" value={from} onChange={setFrom} />
          </div>
          <div>
            <span className={labelCls}>Hasta</span>
            <DatePicker name="to" value={to} onChange={setTo} />
          </div>
        </div>
      )}

      <div>
        <span className={labelCls}>Formato</span>
        <div role="radiogroup" aria-label="Formato" className="flex flex-wrap gap-2">
          {(
            [
              ["xlsx", "Excel (.xlsx)"],
              ["pdf", "PDF"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-ink"
            >
              <input
                type="radio"
                name="format"
                value={value}
                checked={format === value}
                onChange={() => setFormat(value)}
                className="size-4 accent-[var(--primary)]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {invalid && <p className="text-sm font-medium text-danger">La fecha inicial no puede ser posterior a la final.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={invalid ? undefined : `/api/export/${dataset}?${params}`}
          aria-disabled={invalid}
          className={`${btnPrimary} ${invalid ? "pointer-events-none opacity-60" : ""}`}
        >
          Descargar {format === "pdf" ? "PDF" : "Excel"}
        </a>
        <p className="text-xs text-muted">Máximo 366 días por archivo. Los datos respetan tus permisos.</p>
      </div>
    </div>
  );
}
