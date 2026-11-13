"use client";

import { useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { inputCls } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { replyTicket } from "./actions";

/** Respuesta en una solicitud. Al enviarse con éxito el campo se vacía (el hilo se actualiza solo). */
export function ReplyForm({ ticketId, resolved }: { ticketId: string; resolved: boolean }) {
  const formRef = useRef<HTMLDivElement>(null);

  // Se envuelve la acción para vaciar el campo al tener éxito (ActionForm conserva los campos cuando hay error).
  async function action(prev: ActionState, formData: FormData) {
    const result = await replyTicket(prev, formData);
    if (result?.ok) formRef.current?.querySelector("textarea")?.form?.reset();
    return result;
  }

  return (
    <div ref={formRef}>
      <ActionForm action={action} submitLabel={resolved ? "Responder y reabrir" : "Responder"} pendingLabel="Enviando…">
        <input type="hidden" name="ticket_id" value={ticketId} />
        <textarea
          name="body"
          rows={3}
          required
          maxLength={4000}
          aria-label="Tu mensaje"
          placeholder={resolved ? "Si sigue el problema, cuéntanos y se reabrirá" : "Escribe tu mensaje…"}
          className={inputCls}
        />
      </ActionForm>
    </div>
  );
}
