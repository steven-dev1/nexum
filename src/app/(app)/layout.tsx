import { Suspense } from "react";
import { AdminNavLink, AppNav } from "@/components/app-nav";
import { BackgroundRefresh } from "@/components/background-refresh";
import { Brand } from "@/components/brand";
import { PushToggle } from "@/components/push-toggle";
import { MobileNav, SheetLink } from "@/components/mobile-nav";
import { Badge, btnGhost } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { getProfile, isAdmin, roleLabel } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";

/** Enlace a /admin en la barra lateral: solo para administradores. */
async function AdminItem() {
  const profile = await getProfile();
  if (!isAdmin(profile)) return null;
  return (
    <li>
      <AdminNavLink variant="side" />
    </li>
  );
}

/** Enlace a /admin en la hoja «Más» (celular): solo para administradores. */
async function AdminSheetItem() {
  const profile = await getProfile();
  if (!isAdmin(profile)) return null;
  return (
    <li>
      <SheetLink href="/admin" icon="shield" label="Administración" hint="Usuarios, unidades y zonas comunes" />
    </li>
  );
}

/** Cuenta en la hoja «Más» (celular): quién eres y cerrar sesión. */
async function MobileAccount() {
  const profile = await getProfile();
  return (
    <div className="space-y-3">
      <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
      <div className="rounded-2xl border border-line bg-bg p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-on-primary">
            {profile.fullName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{profile.fullName}</p>
            <p className="truncate text-xs text-muted">{profile.unitLabel ?? profile.email}</p>
          </div>
          <Badge tone={profile.role === "residente" ? "primary" : "accent"}>{roleLabel[profile.role]}</Badge>
        </div>
        <form action={signOut} className="mt-4">
          <button type="submit" className={`${btnGhost} w-full`}>
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

async function UserCard() {
  const profile = await getProfile();
  return (
    <div className="mb-3 rounded-lg bg-surface-2 p-3">
      <p className="truncate text-sm font-semibold text-ink">{profile.fullName}</p>
      <p className="mb-2 truncate text-xs text-muted">{profile.unitLabel ?? profile.email}</p>
      <div className="flex items-center justify-between gap-2">
        <Badge tone={profile.role === "residente" ? "primary" : "accent"}>{roleLabel[profile.role]}</Badge>
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
              <AdminItem />
            </Suspense>
          }
        />
        <div className="mt-auto">
          <div className="mb-3">
            <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
          </div>
          <Suspense fallback={<div className="mb-3 h-20 rounded-lg bg-surface-2" />}>
            <UserCard />
          </Suspense>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:hidden">
          <Brand />
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-8">
          {/* El <Suspense> de las páginas lo aporta (app)/loading.tsx. */}
          {children}
        </main>
      </div>

      <BackgroundRefresh />
      <MobileNav
        adminSlot={
          <Suspense fallback={null}>
            <AdminSheetItem />
          </Suspense>
        }
        account={
          <Suspense fallback={<div className="h-28 rounded-2xl bg-surface-2" />}>
            <MobileAccount />
          </Suspense>
        }
      />
    </div>
  );
}
