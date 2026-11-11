import { redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { PageHeader } from "@/components/ui";
import { getProfile, isAdmin } from "@/lib/auth";

// Control de acceso de la interfaz. La seguridad real está en la RLS de Supabase
// y en la verificación de rol de cada Server Action.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await getProfile();
  if (!isAdmin(profile)) redirect("/");

  return (
    <>
      <PageHeader
        title="Administración"
        description="Usuarios, unidades y zonas comunes del conjunto."
      />
      <AdminTabs />
      {children}
    </>
  );
}
