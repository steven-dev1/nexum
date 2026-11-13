"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/unidades", label: "Unidades" },
  { href: "/admin/invitaciones", label: "Invitaciones" },
  { href: "/admin/zonas", label: "Zonas comunes" },
  { href: "/admin/reportes", label: "Reportes" },
] as { href: string; label: string; exact?: boolean }[];

/** Control segmentado (sin scroll horizontal): cabe completo incluso en celular. */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administración" className="mb-6">
      <ul className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1 sm:inline-flex sm:w-auto">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors sm:px-5 ${
                  active ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
