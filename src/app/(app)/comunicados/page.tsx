import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import {
  Badge,
  Card,
  Empty,
  Field,
  PageHeader,
  SectionTitle,
  btnGhost,
  btnSm,
  inputCls,
} from "@/components/ui";
import { getProfile, isAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { markAsRead, publishAnnouncement } from "./actions";

export const metadata: Metadata = { title: "Comunicados" };

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "todos" | "torre";
  tower: string | null;
  pinned: boolean;
  published_at: string;
};

export default async function ComunicadosPage() {
  const profile = await getProfile();
  const admin = isAdmin(profile);
  const supabase = await createClient();

  const [listRes, readsRes, towersRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, audience, tower, pinned, published_at")
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(30),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", profile.id),
    admin ? supabase.from("units").select("tower") : Promise.resolve({ data: [] as { tower: string }[] }),
  ]);

  const items = (listRes.data ?? []) as Announcement[];
  const read = new Set((readsRes.data ?? []).map((r) => r.announcement_id as string));
  const towers = [...new Set((towersRes.data ?? []).map((u) => u.tower).filter(Boolean))].sort();

  return (
    <>
      <PageHeader
        title="Comunicados"
        description="Avisos de la administración para todo el conjunto o para tu torre."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {items.length === 0 ? (
            <Card>
              <Empty>No hay comunicados todavía.</Empty>
            </Card>
          ) : (
            items.map((a) => {
              const isRead = read.has(a.id);
              return (
                <Card key={a.id} className={!isRead && !admin ? "border-l-4 !border-l-accent" : ""}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-ink">{a.title}</h2>
                    <div className="flex gap-1.5">
                      {a.pinned && <Badge tone="accent">Fijado</Badge>}
                      <Badge tone={a.audience === "torre" ? "primary" : "neutral"}>
                        {a.audience === "torre" ? `Torre ${a.tower}` : "Todo el conjunto"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{fmtDateTime(a.published_at)}</p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink">{a.body}</p>
                  {!admin && (
                    <div className="mt-4">
                      {isRead ? (
                        <Badge tone="success">Leído</Badge>
                      ) : (
                        <form action={markAsRead}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className={`${btnGhost} ${btnSm}`}>
                            Marcar como leído
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {admin && (
          <Card className="h-fit lg:sticky lg:top-8">
            <SectionTitle>Publicar comunicado</SectionTitle>
            <ActionForm action={publishAnnouncement} submitLabel="Publicar" variant="accent">
              <Field label="Título">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Mensaje">
                <textarea name="body" rows={5} required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dirigido a">
                  <select name="audience" defaultValue="todos" className={inputCls}>
                    <option value="todos">Todos</option>
                    <option value="torre">Una torre</option>
                  </select>
                </Field>
                <Field label="Torre">
                  <select name="tower" defaultValue="" className={inputCls}>
                    <option value="">—</option>
                    {towers.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="pinned" className="size-4 accent-[var(--primary)]" />
                Fijar arriba
              </label>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
