import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const ATTACH_BUCKET = "attachments";
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Los archivos los nombra la app: `<uuid>.pdf`. Cualquier otra ruta recibida se descarta. */
export const ATTACH_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

export type AttachmentView = { id: string; name: string; size_bytes: number; file_path: string };
export type NewAttachment = { path: string; name: string; size: number };

export const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Adjuntos nuevos que vienen del formulario (ya subidos al bucket por el navegador). */
function readNew(formData: FormData): NewAttachment[] {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("new_attachments") ?? "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (a): a is NewAttachment =>
        !!a &&
        typeof a.path === "string" &&
        ATTACH_PATH_RE.test(a.path) &&
        typeof a.name === "string" &&
        a.name.length > 0 &&
        Number.isInteger(a.size) &&
        a.size > 0 &&
        a.size <= MAX_ATTACHMENT_BYTES,
    )
    .map((a) => ({ path: a.path, name: a.name.slice(0, 200), size: a.size }));
}

/**
 * Aplica los cambios de adjuntos de un formulario: agrega los nuevos y quita los marcados
 * (fila y archivo). Devuelve un mensaje de error si algo falla o se pasa del límite.
 */
export async function syncAttachments(
  supabase: Supabase,
  parent: { announcement_id: string } | { assembly_id: string },
  formData: FormData,
): Promise<string | null> {
  const column = "announcement_id" in parent ? "announcement_id" : "assembly_id";
  const parentId = "announcement_id" in parent ? parent.announcement_id : parent.assembly_id;

  const removeIds = (formData.getAll("remove_attachment") as string[]).filter(Boolean);
  const fresh = readNew(formData);

  const { data: current } = await supabase.from("attachments").select("id, file_path").eq(column, parentId);
  const existing = current ?? [];
  const toRemove = existing.filter((a) => removeIds.includes(a.id));
  if (existing.length - toRemove.length + fresh.length > MAX_ATTACHMENTS) {
    return `Máximo ${MAX_ATTACHMENTS} archivos adjuntos.`;
  }

  if (toRemove.length) {
    const { error } = await supabase
      .from("attachments")
      .delete()
      .in(
        "id",
        toRemove.map((a) => a.id),
      );
    if (error) return "No se pudieron quitar algunos adjuntos.";
    await supabase.storage.from(ATTACH_BUCKET).remove(toRemove.map((a) => a.file_path));
  }
  if (fresh.length) {
    const { error } = await supabase
      .from("attachments")
      .insert(
        fresh.map((a) => ({
          announcement_id: column === "announcement_id" ? parentId : null,
          assembly_id: column === "assembly_id" ? parentId : null,
          file_path: a.path,
          name: a.name,
          size_bytes: a.size,
        })),
      );
    if (error) return "No se pudieron guardar los adjuntos.";
  }
  return null;
}

/** URLs firmadas (1 h) para abrir los PDF: ruta → URL. */
export async function signAttachmentUrls(supabase: Supabase, items: { file_path: string }[]) {
  const urls: Record<string, string> = {};
  if (items.length === 0) return urls;
  const { data } = await supabase.storage.from(ATTACH_BUCKET).createSignedUrls(
    items.map((i) => i.file_path),
    3600,
  );
  for (const s of data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  return urls;
}

/** Borra del almacenamiento todos los adjuntos de un padre (antes de eliminarlo). */
export async function purgeAttachments(supabase: Supabase, column: "announcement_id" | "assembly_id", id: string) {
  const { data } = await supabase.from("attachments").select("file_path").eq(column, id);
  const paths = (data ?? []).map((a) => a.file_path);
  if (paths.length) await supabase.storage.from(ATTACH_BUCKET).remove(paths);
}
