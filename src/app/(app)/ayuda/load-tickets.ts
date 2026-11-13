import { createClient } from "@/lib/supabase/server";
import type { TicketStatus } from "@/lib/support";
import type { TicketView } from "./ticket-card";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Solicitudes con sus mensajes y capturas. La RLS decide cuáles se ven: cada persona las suyas, la administración todas.
 * `statuses` filtra por estado; `withAuthors` agrega el nombre de quien la envió (solo tiene sentido para administración).
 */
export async function loadTickets(
  supabase: Supabase,
  opts: { statuses?: TicketStatus[]; target?: string; userId?: string; withAuthors?: boolean; limit?: number } = {},
): Promise<TicketView[]> {
  let query = supabase
    .from("support_tickets")
    .select("id, user_id, kind, target, subject, status, context, photo_path, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(opts.limit ?? 60);
  if (opts.statuses?.length) query = query.in("status", opts.statuses);
  if (opts.target) query = query.eq("target", opts.target);
  if (opts.userId) query = query.eq("user_id", opts.userId);
  const { data } = await query;
  const tickets = data ?? [];
  if (tickets.length === 0) return [];

  const ids = tickets.map((t) => t.id);
  const photoPaths = tickets.map((t) => t.photo_path).filter((p): p is string => !!p);

  const [messagesRes, signedRes, authorsRes] = await Promise.all([
    supabase.from("support_messages").select("id, ticket_id, body, from_staff, created_at").in("ticket_id", ids).order("created_at"),
    photoPaths.length ? supabase.storage.from("support-files").createSignedUrls(photoPaths, 3600) : Promise.resolve({ data: [] }),
    opts.withAuthors
      ? supabase
          .from("profiles")
          .select("id, full_name, email, units(tower, number)")
          .in("id", [...new Set(tickets.map((t) => t.user_id))])
      : Promise.resolve({ data: [] }),
  ]);

  const byTicket = new Map<string, TicketView["messages"]>();
  for (const m of messagesRes.data ?? []) {
    byTicket.set(m.ticket_id, [...(byTicket.get(m.ticket_id) ?? []), { id: m.id, body: m.body, from_staff: m.from_staff, created_at: m.created_at }]);
  }
  const photoUrls = new Map<string, string>();
  for (const s of signedRes.data ?? []) if (s.path && s.signedUrl) photoUrls.set(s.path, s.signedUrl);
  const authors = new Map<string, string>();
  for (const a of (authorsRes.data ?? []) as unknown as { id: string; full_name: string; email: string | null; units: { tower: string; number: string } | null }[]) {
    authors.set(a.id, a.full_name || a.email || "Usuario");
  }

  return tickets.map((t) => ({
    id: t.id,
    kind: t.kind,
    target: t.target,
    subject: t.subject,
    status: t.status as TicketStatus,
    created_at: t.created_at,
    updated_at: t.updated_at,
    context: (t.context ?? null) as TicketView["context"],
    photoUrl: t.photo_path ? photoUrls.get(t.photo_path) : undefined,
    author: authors.get(t.user_id),
    messages: byTicket.get(t.id) ?? [],
  }));
}
