import { Badge, btnGhost, btnSm } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, kindLabel, targetLabel, type TicketStatus } from "@/lib/support";
import { setTicketStatus } from "./actions";
import { ReplyForm } from "./reply-form";

export type TicketView = {
  id: string;
  kind: string;
  target: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  context: { page?: string; device?: string; viewport?: string; role?: string; version?: string } | null;
  photoUrl?: string;
  /** Quién la envió (solo se muestra a la administración). */
  author?: string;
  messages: { id: string; body: string; from_staff: boolean; created_at: string }[];
};

/** Una solicitud con su hilo de mensajes, su captura y el formulario de respuesta (y el cambio de estado, para administración). */
export function TicketCard({ ticket: t, admin }: { ticket: TicketView; admin: boolean }) {
  const ctx = t.context ?? {};
  return (
    <details className="group rounded-xl border border-line bg-surface open:shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="break-words font-semibold text-ink">{t.subject}</p>
          <p className="mt-0.5 text-xs text-muted">
            {kindLabel(t.kind)} · {targetLabel(t.target)}
            {admin && t.author ? ` · ${t.author}` : ""} · {fmtDateTime(t.updated_at)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
      </summary>

      <div className="space-y-4 border-t border-line p-4">
        <ul className="space-y-3">
          {t.messages.map((m) => (
            <li key={m.id} className={`flex ${m.from_staff ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.from_staff ? "bg-primary-soft text-primary-ink" : "bg-surface-2 text-ink"
                }`}
              >
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {m.from_staff ? "Administración" : admin ? (t.author ?? "Usuario") : "Tú"} · {fmtDateTime(m.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {t.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada y temporal de Supabase Storage
          <img src={t.photoUrl} alt="Captura adjunta" className="max-h-72 rounded-xl border border-line object-contain" />
        )}

        {admin && (ctx.page || ctx.device) && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-5 text-muted">
            {ctx.page && <>Sección: {ctx.page}. </>}
            {ctx.viewport && <>Pantalla: {ctx.viewport}. </>}
            {ctx.version && <>Versión: {ctx.version}. </>}
            {ctx.device && <>Dispositivo: {ctx.device}</>}
          </p>
        )}

        {admin && (
          <div className="flex flex-wrap gap-2">
            {(["abierta", "en_curso", "resuelta"] as const)
              .filter((s) => s !== t.status)
              .map((s) => (
                <form key={s} action={setTicketStatus}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="status" value={s} />
                  <button type="submit" className={`${btnGhost} ${btnSm}`}>
                    Marcar «{STATUS_LABEL[s]}»
                  </button>
                </form>
              ))}
          </div>
        )}

        <ReplyForm ticketId={t.id} resolved={t.status === "resuelta"} />
      </div>
    </details>
  );
}
