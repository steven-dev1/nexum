import { Suspense } from "react";
import { AdminNavLink, AppNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { Badge, btnGhost } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { getProfile, isAdmin, roleLabel } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";

/** Enlace a /admin: solo se renderiza para administradores. */
async function AdminItem({ variant }: { variant: "side" | "bottom" }) {
  const profile = await getProfile();
  if (!isAdmin(profile)) return null;
  return (
    <li>
      <AdminNavLink variant={variant} />
    </li>
  );
}

async function UserCard() {
  const profile = await getProfile();
  return (
    <div className="mb-3 rounded-lg bg-surface-2 p-3">
      <p className="truncate text-sm font-semibold text-ink">{profile.fullName}</p>
      <p className="mb-2 truncate text-xs text-muted">{profile.unitLabel ?? profile.email}</p>
      <div className="flex items-center justify-between gap-2">
        <Badge tone={profile.role === "residente" ? "primary" : "accent"}>
          {roleLabel[profile.role]}
        </Badge>
        <form action={signOut}>
          <button type="submit" className={`${btnGhost} !px-2.5 !py-1 !text-xs`}>
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <Brand className="mb-6 px-1" />
        <AppNav
          variant="side"
          extra={
            <Suspense fallback={null}>
              <AdminItem variant="side" />
            </Suspense>
          }
        />
        <div className="mt-auto">
          <Suspense fallback={<div className="mb-3 h-20 rounded-lg bg-surface-2" />}>
            <UserCard />
          </Suspense>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Brand />
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-8">
          {/* El <Suspense> de las páginas lo aporta (app)/loading.tsx. */}
          {children}
        </main>
      </div>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface md:hidden"
      >
        <AppNav
          variant="bottom"
          extra={
            <Suspense fallback={null}>
              <AdminItem variant="bottom" />
            </Suspense>
          }
        />
      </nav>
    </div>
  );
}
