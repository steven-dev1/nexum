"use client";

import { startTransition, useActionState, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { useModal } from "@/components/modal";
import { Select, type SelectOption } from "@/components/select";
import { TimePicker } from "@/components/time-picker";
import { Field, btnAccent, btnGhost, btnPrimary, inputCls, labelCls, scrollCls } from "@/components/ui";
import { DURATIONS, MAX_VALIDITY_DAYS, USES } from "@/lib/invitation-options";
import { fmtDateTime, todayBogota } from "@/lib/format";
import { createInvitation } from "./actions";

const durationOptions: SelectOption[] = [
  ...DURATIONS.map((d) => ({ value: d.value, label: d.label })),
  { value: "custom", label: "Elegir fecha y hora…", hint: `Hasta ${MAX_VALIDITY_DAYS} días` },
];

/**
 * Crea una invitación. Al terminar muestra el enlace (solo se ve esta vez, porque en la
 * base de datos únicamente queda su huella) con opciones para copiarlo o compartirlo.
 */
export function InviteForm({ unitOptions, defaultUnit }: { unitOptions: SelectOption[]; defaultUnit?: string }) {
  const modal = useModal();
  const [state, formAction, pending] = useActionState(createInvitation, null);
  const [role, setRole] = useState("residente");
  const [duration, setDuration] = useState("7d");
  const [copied, setCopied] = useState(false);
  const [round, setRound] = useState(0); // «Crear otra» reinicia el formulario

  const link = state?.link;

  if (link) {
    const expires = state?.expiresAt ? fmtDateTime(state.expiresAt) : "";
    const message = `Te invito a Nexum, la app de nuestro conjunto. Crea tu cuenta con este enlace (vence ${expires}): ${link}`;
    const canShare = typeof navigator !== "undefined" && "share" in navigator;

    async function copy() {
      try {
        await navigator.clipboard.writeText(link!);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Si el navegador bloquea el portapapeles, el campo sigue seleccionable a mano.
      }
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-line px-6 py-5 ${scrollCls}`}>
          <p className="flex items-start gap-2 rounded-xl bg-success-soft px-3.5 py-3 text-sm font-medium text-success">
            <svg
              className="mt-0.5 size-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
            Invitación creada. Vence el {expires}.
          </p>

          <div>
            <span className={labelCls}>Enlace de invitación</span>
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Enlace de invitación"
              className={`${inputCls} font-mono !text-sm`}
            />
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Cópialo ahora: por seguridad no se puede volver a ver. Si lo pierdes, crea otro y cancela este.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <button type="button" onClick={copy} className={btnPrimary}>
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnGhost}
            >
              WhatsApp
            </a>
            {canShare && (
              <button
                type="button"
                onClick={() =>
                  navigator.share({ title: "Invitación a Nexum", text: message, url: link }).catch(() => {})
                }
                className={btnGhost}
              >
                Compartir…
              </button>
            )}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end">
          <button type="button" onClick={() => setRound((r) => r + 1)} className={btnGhost}>
            Crear otra
          </button>
          <button type="button" onClick={() => modal?.close()} className={btnAccent}>
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      key={round}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={`min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-line px-6 py-5 ${scrollCls}`}>
        <Select
          label="Invitar como"
          name="role"
          required
          value={role}
          onChange={setRole}
          options={[
            { value: "residente", label: "Residente", hint: "Entra a una unidad: paquetes, reservas y avisos" },
            { value: "porteria", label: "Portería", hint: "Registra y entrega paquetes (un solo uso)" },
          ]}
        />

        {role === "residente" && (
          <>
            <Select
              label="Unidad"
              name="unit_id"
              required
              placeholder="Selecciona la unidad…"
              options={unitOptions}
              defaultValue={defaultUnit ?? ""}
              autoFocus
            />
            <Select
              label="¿Cuántas personas pueden usarlo?"
              name="max_uses"
              required
              defaultValue="1"
              options={USES.map((n) => ({
                value: String(n),
                label: n === 1 ? "1 persona (un solo uso)" : `Hasta ${n} personas`,
              }))}
            />
          </>
        )}

        <Select
          label="Vigencia"
          name="duration"
          required
          value={duration}
          onChange={setDuration}
          hint="Pasado ese tiempo el enlace deja de funcionar."
          options={durationOptions}
        />
        {duration === "custom" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={labelCls}>Vence el</span>
              <DatePicker name="expires_date" min={todayBogota()} required />
            </div>
            <div>
              <span className={labelCls}>A las</span>
              <TimePicker name="expires_time" required step={15} />
            </div>
          </div>
        )}

        <Field label="Nota (opcional)" hint="Solo la ves tú. Ej.: «Familia Pérez», «Nuevo arrendatario».">
          <input name="label" maxLength={80} className={inputCls} />
        </Field>

        {state?.error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {state.error}
          </p>
        )}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end">
        <button type="button" onClick={() => modal?.close()} className={btnGhost}>
          Cancelar
        </button>
        <button type="submit" disabled={pending} className={btnAccent}>
          {pending ? "Creando…" : "Crear enlace"}
        </button>
      </div>
    </form>
  );
}
