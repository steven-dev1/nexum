"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Modal, useModal } from "@/components/modal";

const svg = (d: ReactNode, cls = "size-[22px]") => (
  <svg
    className={`${cls} shrink-0`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {d}
  </svg>
);

const icons = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  package: (
    <>
      <path d="m21 8-9-5-9 5v8l9 5 9-5V8z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
} as const;

export type NavIcon = keyof typeof icons;

/** Las más usadas van en la barra; el resto, en «Más». */
const PRIMARY: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/paqueteria", label: "Paquetes", icon: "package" },
  { href: "/reservas", label: "Reservas", icon: "calendar" },
  { href: "/comunicados", label: "Avisos", icon: "megaphone" },
];
/** Rutas que viven dentro de «Más» (para resaltar el botón cuando estás en una de ellas). */
const OVERFLOW_PATHS = ["/asambleas", "/directorio", "/admin"];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

const tabCls = (active: boolean) =>
  `flex w-full cursor-pointer flex-col items-center gap-1 pb-1.5 pt-2 text-[11px] transition-colors ${
    active ? "font-semibold text-ink" : "font-medium text-muted hover:text-ink"
  }`;
const pillCls = (active: boolean) =>
  `inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
    active ? "bg-accent text-accent-ink" : ""
  }`;

/**
 * Barra inferior para celular: 4 secciones principales + «Más» (hoja inferior
 * con el resto de secciones y la cuenta). `adminSlot` y `account` los renderiza
 * el servidor, porque dependen del usuario.
 */
export function MobileNav({ adminSlot, account }: { adminSlot: ReactNode; account: ReactNode }) {
  const pathname = usePathname();
  const moreActive = OVERFLOW_PATHS.some((p) => pathname.startsWith(p));

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 px-1">
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={tabCls(active)}>
                <span className={pillCls(active)}>{svg(icons[item.icon])}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Modal
            title="Más"
            description="Otras secciones y tu cuenta."
            triggerLabel="Más opciones"
            triggerClassName={tabCls(moreActive)}
            trigger={
              <>
                <span className={pillCls(moreActive)}>{svg(icons.grid)}</span>
                Más
              </>
            }
          >
            <div className="space-y-5 border-t border-line px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <ul className="space-y-1.5">
                <li>
                  <SheetLink href="/asambleas" icon="users" label="Asambleas" hint="Convocatorias y recordatorios" />
                </li>
                <li>
                  <SheetLink href="/directorio" icon="phone" label="Directorio" hint="Teléfonos útiles y proveedores" />
                </li>
                {adminSlot}
              </ul>
              {account}
            </div>
          </Modal>
        </li>
      </ul>
    </nav>
  );
}

/** Enlace grande dentro de la hoja «Más»; cierra la hoja al navegar. */
export function SheetLink({ href, icon, label, hint }: { href: string; icon: NavIcon; label: string; hint?: string }) {
  const pathname = usePathname();
  const modal = useModal();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={() => modal?.close()}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
        active ? "border-primary bg-primary-soft" : "border-line bg-bg hover:border-muted/50"
      }`}
    >
      <span
        className={`inline-flex size-10 items-center justify-center rounded-xl ${
          active ? "bg-primary text-on-primary" : "bg-surface-2 text-ink"
        }`}
      >
        {svg(icons[icon], "size-5")}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${active ? "text-primary-ink" : "text-ink"}`}>{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
      {svg(<path d="m9 18 6-6-6-6" />, "size-4 text-muted")}
    </Link>
  );
}
