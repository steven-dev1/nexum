import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Field, btnGhost, inputCls } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { updateMyContact } from "@/lib/actions/contact";
import { createClient } from "@/lib/supabase/server";
import { whatsappConfigured } from "@/lib/whatsapp";

/**
 * Botón + modal para que cada persona indique su celular y acepte (o no) los avisos por WhatsApp.
 * Solo aparece si el conjunto tiene configurado el envío de WhatsApp.
 */
export async function WhatsappSettings({ className = "" }: { className?: string }) {
  if (!whatsappConfigured()) return null;

  const profile = await getProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("phone, whatsapp_opt_in").eq("id", profile.id).maybeSingle();
  const active = data?.whatsapp_opt_in ?? false;

  return (
    <div className={className}>
      <Modal
        title="Avisos por WhatsApp"
        description="Recibe paquetes, comunicados y votaciones también en tu WhatsApp."
        trigger={active ? "WhatsApp: activado" : "Recibir avisos por WhatsApp"}
        triggerClassName={`${btnGhost} w-full`}
      >
        <ActionForm action={updateMyContact} submitLabel="Guardar" pendingLabel="Guardando…">
          <Field label="Celular" hint="Con o sin el indicativo de país. Ej.: 3001234567">
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={40}
              defaultValue={data?.phone ?? ""}
              placeholder="3001234567"
              className={inputCls}
            />
          </Field>
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name="whatsapp"
              defaultChecked={active}
              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            />
            <span>
              Acepto recibir avisos del conjunto por WhatsApp en este número. Puedo desactivarlo cuando quiera.
            </span>
          </label>
        </ActionForm>
      </Modal>
    </div>
  );
}
