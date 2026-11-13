import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, ContentSkeleton, Empty, PageHeader } from "@/components/ui";
import { HelpButton } from "@/components/help-button";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTickets } from "./load-tickets";
import { TicketCard } from "./ticket-card";

export const metadata: Metadata = { title: "Mis solicitudes" };

export default function AyudaPage() {
  return (
    <>
      <PageHeader
        title="Mis solicitudes"
        description="Tus pedidos de ayuda, problemas y sugerencias, con las respuestas."
        action={<HelpButton variant="primary" label="Nueva solicitud" whatsapp={process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP} />}
      />
      <Suspense fallback={<ContentSkeleton />}>
        <AyudaContent />
      </Suspense>
    </>
  );
}

async function AyudaContent() {
  const profile = await getProfile();
  const supabase = await createClient();
  // Solo las propias: la administración ve las de todos en «Administración → Soporte».
  const mine = await loadTickets(supabase, { userId: profile.id });

  if (mine.length === 0) {
    return (
      <Card>
        <Empty>Aún no has enviado solicitudes. Usa «Nueva solicitud» o el botón «Ayuda» del menú.</Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {mine.map((t) => (
        <TicketCard key={t.id} ticket={t} admin={false} />
      ))}
    </div>
  );
}
