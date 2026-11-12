"use client";

import { useRef, useState } from "react";
import { btnGhost, btnSm, labelCls } from "@/components/ui";
import {
  ATTACH_BUCKET,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  fmtSize,
  type AttachmentView,
  type NewAttachment,
} from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

const pdfIcon = (
  <svg
    className="size-5 shrink-0 text-danger"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

/**
 * Adjuntos PDF de un formulario. Los archivos nuevos se suben al bucket privado apenas se eligen y viajan
 * en el campo `new_attachments`; los existentes se quitan marcándolos (`remove_attachment`).
 */
export function AttachmentsField({ existing = [] }: { existing?: AttachmentView[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [added, setAdded] = useState<NewAttachment[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kept = existing.filter((a) => !removed.includes(a.id));
  const count = kept.length + added.length;

  async function upload(files: FileList) {
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      let total = count;
      const next: NewAttachment[] = [];
      for (const file of Array.from(files)) {
        if (total >= MAX_ATTACHMENTS) {
          setError(`Máximo ${MAX_ATTACHMENTS} archivos.`);
          break;
        }
        if (file.type !== "application/pdf") {
          setError("Solo se permiten archivos PDF.");
          continue;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setError(`«${file.name}» pesa más de 10 MB.`);
          continue;
        }
        const path = `${crypto.randomUUID()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from(ATTACH_BUCKET)
          .upload(path, file, { contentType: "application/pdf" });
        if (upErr) {
          setError(`No se pudo subir «${file.name}».`);
          continue;
        }
        next.push({ path, name: file.name, size: file.size });
        total++;
      }
      if (next.length) setAdded((a) => [...a, ...next]);
    } finally {
      setUploading(false);
    }
  }

  const row = (key: string, name: string, size: number, onRemove: () => void) => (
    <li key={key} className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2">
      {pdfIcon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{name}</span>
        <span className="text-xs text-muted">{fmtSize(size)}</span>
      </span>
      <button type="button" onClick={onRemove} className={`${btnGhost} ${btnSm}`}>
        Quitar
      </button>
    </li>
  );

  return (
    <div>
      <span className={labelCls}>Archivos adjuntos (PDF)</span>
      <input type="hidden" name="new_attachments" value={JSON.stringify(added)} />
      {removed.map((id) => (
        <input key={id} type="hidden" name="remove_attachment" value={id} />
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = "";
        }}
      />

      {count > 0 && (
        <ul className="mb-2 space-y-2">
          {kept.map((a) => row(a.id, a.name, a.size_bytes, () => setRemoved((r) => [...r, a.id])))}
          {added.map((a) => row(a.path, a.name, a.size, () => setAdded((l) => l.filter((x) => x.path !== a.path))))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || count >= MAX_ATTACHMENTS}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-bg px-3 py-3 text-sm font-semibold text-ink transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? "Subiendo…" : count >= MAX_ATTACHMENTS ? "Límite de archivos alcanzado" : "Adjuntar PDF"}
      </button>
      <p className="mt-1.5 text-xs text-muted">Hasta {MAX_ATTACHMENTS} archivos de 10 MB cada uno.</p>
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
