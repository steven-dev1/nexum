"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (d: ReactNode) => (
  <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

type Item = { href: string; label: string; icon: ReactNode };

const items: Item[] = [
  { href: "/", label: "Inicio", icon: icon(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>) },
  { href: "/paqueteria", label: "Paquetería", icon: icon(<><path d="m21 8-9-5-9 5v8l9 5 9-5V8z" /><path d="m3 8 9 5 9-5M12 13v8" /></>) },
  { href: "/reservas", label: "Reservas", icon: icon(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>) },
  { href: "/asambleas", label: "Asambleas", icon: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>) },
  { href: "/comunicados", label: "Comunicados", icon: icon(<><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" /><path d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13" /></>) },
];

const adminItem: Item = {
  href: "/admin",
  label: "Admin",
  icon: icon(<><path d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5l-8-3z" /><path d="m9 12 2 2 4-4" /></>),
};

function NavItem({ item, variant, active }: { item: Item; variant: "side" | "bottom"; active: boolean }) {
  if (variant === "bottom") {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
          active ? "text-primary-ink" : "text-muted"
        }`}
      >
        <span className={`rounded-full px-4 py-1 ${active ? "bg-accent text-accent-ink" : ""}`}>
          {item.icon}
        </span>
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? "bg-primary text-on-primary" : "text-ink hover:bg-surface-2"
      }`}
    >
      {item.icon}
      {item.label === "Admin" ? "Administración" : item.label}
    </Link>
  );
}

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

/** `extra` permite añadir <li> adicionales (p. ej. el enlace de administración, solo para admins). */
export function AppNav({ variant, extra }: { variant: "side" | "bottom"; extra?: ReactNode }) {
  const pathname = usePathname();

  return (
    <ul className={variant === "bottom" ? "grid grid-flow-col auto-cols-fr" : "space-y-1"}>
      {items.map((item) => (
        <li key={item.href}>
          <NavItem item={item} variant={variant} active={isActive(pathname, item.href)} />
        </li>
      ))}
      {extra}
    </ul>
  );
}

export function AdminNavLink({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  return <NavItem item={adminItem} variant={variant} active={isActive(pathname, adminItem.href)} />;
}
