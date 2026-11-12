import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { Badge, btnDanger, btnGhost, btnSm } from "@/components/ui";
import { unitLabel, type Profile } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { closePoll, createPoll, deletePoll } from "./poll-actions";
import { PollFields } from "./poll-form";
import { VoteForm } from "./vote-form";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PollView = {
  id: string;
  assembly_id: string;
  question: string;
  description: string | null;
  mode: "secreta" | "nominal";
  closes_at: string | null;
  /** Abierta de verdad: no cerrada a mano y sin pasar la hora de cierre. */
  open: boolean;
  options: { id: string; label: string }[];
  /** Votos por opción; null mientras los resultados no son visibles para quien mira. */
  results: Map<string, number> | null;
  participation: { voted: number; total: number };
  myVote: string | null;
  /** Solo administración y votación nominal: voto de cada unidad. */
  voters: { unit: string; option: string }[];
};

/** Carga las votaciones de varias asambleas con sus opciones, resultados, participación y voto propio. */
export async function loadPolls(supabase: Supabase, assemblyIds: string[], profile: Profile, admin: boolean) {
  const byAssembly = new Map<string, PollView[]>();
  if (assemblyIds.length === 0) return byAssembly;

  const { data: polls } = await supabase
    .from("polls")
    .select("id, assembly_id, question, description, mode, status, closes_at, created_at, poll_options(id, label, position)")
    .in("assembly_id", assemblyIds)
    .order("created_at", { ascending: false });
  if (!polls || polls.length === 0) return byAssembly;

  const ids = polls.map((p) => p.id);
  const [votesRes, ...perPoll] = await Promise.all([
    supabase.from("poll_votes").select("poll_id, option_id, unit_id, units(tower, number)").in("poll_id", ids),
    ...polls.flatMap((p) => [
      supabase.rpc("poll_results", { p_poll: p.id }),
      supabase.rpc("poll_participation", { p_poll: p.id }),
    ]),
  ]);
  const votes = (votesRes.data ?? []) as unknown as {
    poll_id: string;
    option_id: string;
    unit_id: string;
    units: { tower: string; number: string } | null;
  }[];

  polls.forEach((p, i) => {
    const options = [...(p.poll_options ?? [])].sort((a, b) => a.position - b.position);
    const labelOf = new Map(options.map((o) => [o.id, o.label]));
    const open = p.status === "abierta" && (!p.closes_at || Date.parse(p.closes_at) > Date.now());

    const rows = perPoll[i * 2].data as { option_id: string; votes: number }[] | null;
    const part = (perPoll[i * 2 + 1].data as { voted: number; total: number }[] | null)?.[0];
    const mine = votes.find((v) => v.poll_id === p.id && v.unit_id === profile.unitId);

    const view: PollView = {
      id: p.id,
      assembly_id: p.assembly_id,
      question: p.question,
      description: p.description,
      mode: p.mode as PollView["mode"],
      closes_at: p.closes_at,
      open,
      options: options.map((o) => ({ id: o.id, label: o.label })),
      // El servidor ya oculta los resultados a los residentes mientras la votación está abierta.
      results: rows && rows.length > 0 ? new Map(rows.map((r) => [r.option_id, Number(r.votes)])) : null,
      participation: { voted: Number(part?.voted ?? 0), total: Number(part?.total ?? 0) },
      myVote: mine?.option_id ?? null,
      voters:
        admin && p.mode === "nominal"
          ? votes
              .filter((v) => v.poll_id === p.id)
              .map((v) => ({ unit: unitLabel(v.units), option: labelOf.get(v.option_id) ?? "—" }))
              .sort((a, b) => a.unit.localeCompare(b.unit, "es", { numeric: true }))
          : [],
    };
    byAssembly.set(p.assembly_id, [...(byAssembly.get(p.assembly_id) ?? []), view]);
  });
  return byAssembly;
}

/** Botón + modal para crear una votación en una asamblea (solo administración). */
export function NewPoll({ assemblyId }: { assemblyId: string }) {
  return (
    <Modal
      title="Nueva votación"
      description="Se avisa a todos los residentes. Cada unidad tiene un solo voto."
      icon="users"
      trigger="Nueva votación"
      triggerClassName={`${btnGhost} ${btnSm}`}
      size="lg"
    >
      <ActionForm action={createPoll} submitLabel="Abrir votación" pendingLabel="Abriendo…" variant="accent">
        <input type="hidden" name="assembly_id" value={assemblyId} />
        <PollFields />
      </ActionForm>
    </Modal>
  );
}

function Results({ poll }: { poll: PollView }) {
  const results = poll.results;
  if (!results) return null;
  const total = poll.options.reduce((sum, o) => sum + (results.get(o.id) ?? 0), 0);
  const top = Math.max(0, ...poll.options.map((o) => results.get(o.id) ?? 0));

  return (
    <ul className="mt-3 space-y-2.5">
      {poll.options.map((o) => {
        const n = results.get(o.id) ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const leading = !poll.open && n > 0 && n === top;
        return (
          <li key={o.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={`min-w-0 break-words ${leading ? "font-semibold text-ink" : "text-ink"}`}>
                {o.label} {o.id === poll.myVote && <Badge tone="primary">Tu voto</Badge>}
              </span>
              <span className="shrink-0 text-muted">
                {n} {n === 1 ? "voto" : "votos"} · {pct}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className={`h-full rounded-full ${leading ? "bg-accent" : "bg-primary/60"}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Votaciones de una asamblea: votar (residentes), seguimiento y cierre (administración), resultados. */
export function PollsSection({
  polls,
  assemblyId,
  admin,
  canVote,
}: {
  polls: PollView[];
  assemblyId: string;
  admin: boolean;
  /** Solo los residentes con unidad votan. */
  canVote: boolean;
}) {
  if (polls.length === 0 && !admin) return null;

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Votaciones</p>
        {admin && <NewPoll assemblyId={assemblyId} />}
      </div>

      {polls.length === 0 && <p className="mt-2 text-sm text-muted">Aún no hay votaciones en esta asamblea.</p>}

      <ul className="mt-2 space-y-3">
        {polls.map((p) => {
          const pct = p.participation.total ? Math.round((p.participation.voted / p.participation.total) * 100) : 0;
          return (
            <li key={p.id} className="rounded-lg border border-line bg-bg p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 basis-56 font-semibold text-ink">{p.question}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={p.open ? "success" : "neutral"}>{p.open ? "Abierta" : "Cerrada"}</Badge>
                  <Badge tone={p.mode === "secreta" ? "neutral" : "accent"}>
                    {p.mode === "secreta" ? "Voto secreto" : "Voto nominal"}
                  </Badge>
                </div>
              </div>
              {p.description && <p className="mt-1.5 whitespace-pre-line text-sm text-muted">{p.description}</p>}
              {p.open && p.closes_at && <p className="mt-1.5 text-xs text-muted">Cierra el {fmtDateTime(p.closes_at)}</p>}

              {p.open && canVote && (
                <VoteForm pollId={p.id} options={p.options} currentOptionId={p.myVote} />
              )}
              {p.open && canVote && p.myVote && (
                <p className="mt-2 text-xs text-muted">Tu unidad ya votó. Puedes cambiar el voto hasta que cierre.</p>
              )}

              <p className="mt-3 text-xs text-muted">
                Participación: {p.participation.voted} de {p.participation.total} unidades ({pct}%)
              </p>

              {(admin || !p.open) && <Results poll={p} />}
              {!p.open && !p.results && <p className="mt-2 text-sm text-muted">Sin votos registrados.</p>}

              {admin && p.voters.length > 0 && (
                <details className="mt-3 rounded-lg border border-line bg-surface-2 p-2.5">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Voto de cada unidad</summary>
                  <ul className="mt-2 space-y-1 text-sm">
                    {p.voters.map((v) => (
                      <li key={v.unit} className="flex justify-between gap-3">
                        <span className="text-ink">{v.unit}</span>
                        <span className="text-muted">{v.option}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {admin && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.open && (
                    <form action={closePoll}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className={`${btnGhost} ${btnSm}`}>
                        Cerrar y publicar resultados
                      </button>
                    </form>
                  )}
                  <Modal
                    title="Eliminar votación"
                    description={p.question}
                    trigger="Eliminar"
                    triggerClassName={`${btnGhost} ${btnSm}`}
                  >
                    <ActionForm action={deletePoll} submitLabel="Eliminar" pendingLabel="Eliminando…" buttonClassName={btnDanger}>
                      <input type="hidden" name="id" value={p.id} />
                      <p className="text-sm text-muted">Se borran la votación y todos los votos. No se puede deshacer.</p>
                    </ActionForm>
                  </Modal>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
