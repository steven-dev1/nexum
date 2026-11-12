import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Card, ContentSkeleton, Empty, PageHeader, SectionTitle, btnDanger, btnGhost, btnSm } from "@/components/ui";
import { getProfile, isAdmin } from "@/lib/auth";
import { toWhatsAppNumber } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { createEntry, deleteEntry, updateEntry } from "./actions";
import { CATEGORY_LABEL, EntryFields } from "./entry-fields";

export const metadata: Metadata = { title: "Directorio" };

type Entry = {
  id: string;
  category: string;
  name: string;
  phone: string | null;
  has_whatsapp: boolean;
  description: string | null;
  schedule: string | null;
};

export default function DirectorioPage() {
  return (
    <>
      <PageHeader
        title="Directorio"
        description="Teléfonos de emergencia, administración y proveedores del conjunto."
        action={
          <Suspense fallback={null}>
            <NewEntry />
          </Suspense>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <DirectorioContent />
      </Suspense>
    </>
  );
}

async function NewEntry() {
  const profile = await getProfile();
  if (!isAdmin(profile)) return null;
  return (
    <Modal
      title="Nuevo contacto"
      description="Aparece en el directorio de todos los residentes."
      icon="users"
      trigger="Nuevo contacto"
      plus
    >
      <ActionForm action={createEntry} submitLabel="Agregar" pendingLabel="Guardando…" variant="accent">
        <EntryFields />
      </ActionForm>
    </Modal>
  );
}

const iconCls = "size-4";
const phoneIcon = (
  <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

async function DirectorioContent() {
  const profile = await getProfile();
  const admin = isAdmin(profile);
  const supabase = await createClient();
  const { data } = await supabase
    .from("directory_entries")
    .select("id, category, name, phone, has_whatsapp, description, schedule")
    .order("sort_order")
    .order("name");
  const entries = (data ?? []) as Entry[];

  if (entries.length === 0) {
    return (
      <Card>
        <Empty>Aún no hay contactos en el directorio.</Empty>
      </Card>
    );
  }

  const order = Object.keys(CATEGORY_LABEL);
  const groups = order
    .map((key) => ({ key, items: entries.filter((e) => e.category === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <Card key={g.key}>
          <SectionTitle>{CATEGORY_LABEL[g.key]}</SectionTitle>
          <ul className="divide-y divide-line">
            {g.items.map((e) => {
              const wa = e.has_whatsapp ? toWhatsAppNumber(e.phone) : null;
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold text-ink">{e.name}</p>
                    {e.phone && <p className="text-sm text-primary-ink">{e.phone}</p>}
                    {e.schedule && <p className="text-xs text-muted">{e.schedule}</p>}
                    {e.description && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{e.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {e.phone && (
                      <a href={`tel:${e.phone.replace(/[^\d+]/g, "")}`} className={`${btnGhost} ${btnSm}`}>
                        {phoneIcon}
                        Llamar
                      </a>
                    )}
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${btnGhost} ${btnSm}`}
                      >
                        WhatsApp
                      </a>
                    )}
                    {admin && <EditEntry entry={e} />}
                    {admin && <DeleteEntry entry={e} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function EditEntry({ entry: e }: { entry: Entry }) {
  return (
    <Modal title="Editar contacto" description={e.name} icon="edit" trigger="Editar" triggerClassName={`${btnGhost} ${btnSm}`}>
      <ActionForm action={updateEntry} submitLabel="Guardar cambios" pendingLabel="Guardando…">
        <input type="hidden" name="id" value={e.id} />
        <EntryFields
          defaults={{
            name: e.name,
            category: e.category,
            phone: e.phone ?? "",
            hasWhatsapp: e.has_whatsapp,
            description: e.description ?? "",
            schedule: e.schedule ?? "",
          }}
        />
      </ActionForm>
    </Modal>
  );
}

function DeleteEntry({ entry: e }: { entry: Entry }) {
  return (
    <Modal title="Eliminar contacto" description={e.name} trigger="Eliminar" triggerClassName={`${btnGhost} ${btnSm}`}>
      <ActionForm action={deleteEntry} submitLabel="Eliminar" pendingLabel="Eliminando…" buttonClassName={btnDanger}>
        <input type="hidden" name="id" value={e.id} />
        <p className="text-sm text-muted">Se quita del directorio para todos. No se puede deshacer.</p>
      </ActionForm>
    </Modal>
  );
}
