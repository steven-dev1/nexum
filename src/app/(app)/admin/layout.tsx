import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { getProfile, isAdmin } from "@/lib/auth";

// Control de acceso de la interfaz. La seguridad real está en la RLS de Supabase
// y en la verificación de rol de cada Server Action.
async function AdminGate({ children }: { children: ReactNode }) {
  const profile = await getProfile();
  if (!isAdmin(profile)) redirect("/");
  return <>{children}</>;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <PageHeader
        title="Administración"
        description="Resumen del conjunto, usuarios, unidades y zonas comunes."
      />
      <AdminTabs />
      <Suspense fallback={<PageSkeleton />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </>
  );
}
