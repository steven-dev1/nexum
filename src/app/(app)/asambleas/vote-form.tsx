"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { btnAccent } from "@/components/ui";
import { castVote } from "./poll-actions";

/** Opciones de una votación abierta: el residente elige y vota (puede cambiar su voto mientras siga abierta). */
export function VoteForm({
  pollId,
  options,
  currentOptionId,
}: {
  pollId: string;
  options: { id: string; label: string }[];
  currentOptionId: string | null;
}) {
  const [state, action, pending] = useActionState(castVote, null);
  const [choice, setChoice] = useState(currentOptionId ?? "");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      <input type="hidden" name="poll_id" value={pollId} />
      <div role="radiogroup" className="space-y-2">
        {options.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-ink"
          >
            <input
              type="radio"
              name="option_id"
              value={o.id}
              checked={choice === o.id}
              onChange={() => setChoice(o.id)}
              className="size-4 accent-[var(--primary)]"
            />
            {o.label}
          </label>
        ))}
      </div>
      <button type="submit" disabled={pending || !choice || choice === currentOptionId} className={btnAccent}>
        {pending ? "Enviando…" : currentOptionId ? "Cambiar mi voto" : "Votar"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
