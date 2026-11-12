"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { inputCls } from "@/components/ui";

export type RoleFilter = "todos" | "residente" | "porteria" | "admin" | "sin-unidad";

type Counts = Record<RoleFilter, number>;

const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "residente", label: "Residentes" },
  { value: "porteria", label: "Portería" },
  { value: "admin", label: "Administración" },
  { value: "sin-unidad", label: "Sin unidad" },
];

/**
 * Búsqueda y filtros. El estado vive en la URL (`?q=…&rol=…&pagina=…`): se puede compartir,
 * el botón «atrás» funciona y el servidor solo trae la página que se está viendo.
 */
export function UsersToolbar({ q, rol, counts }: { q: string; rol: RoleFilter; counts: Counts }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function go(next: { q?: string; rol?: RoleFilter }) {
    const params = new URLSearchParams();
    const nq = (next.q ?? text).trim();
    const nrol = next.rol ?? rol;
    if (nq) params.set("q", nq);
    if (nrol !== "todos") params.set("rol", nrol);
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            clearTimeout(timer.current);
            const value = e.target.value;
            timer.current = setTimeout(() => go({ q: value }), 350);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              clearTimeout(timer.current);
              go({ q: text });
            }
          }}
          placeholder="Buscar por nombre o correo…"
          aria-label="Buscar usuarios"
          className={`${inputCls} !py-2.5 pl-10`}
        />
        {pending && (
          <span
            aria-hidden
            className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-primary"
          />
        )}
      </div>

      <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = rol === f.value;
          const warn = f.value === "sin-unidad" && counts[f.value] > 0;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => go({ rol: f.value })}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary text-on-primary"
                  : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? "bg-on-primary/20" : warn ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"
                }`}
              >
                {counts[f.value]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
