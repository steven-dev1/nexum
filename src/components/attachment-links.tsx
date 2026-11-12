import { fmtSize, type AttachmentView } from "@/lib/attachments";

/** Lista de PDF adjuntos (enlaces con URL firmada que se abren en otra pestaña). */
export function AttachmentLinks({ items, urls }: { items: AttachmentView[]; urls: Record<string, string> }) {
  const available = items.filter((a) => urls[a.file_path]);
  if (available.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {available.map((a) => (
        <li key={a.id} className="max-w-full">
          <a
            href={urls[a.file_path]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary-ink"
          >
            <svg
              className="size-4 shrink-0 text-danger"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
            </svg>
            <span className="truncate">{a.name}</span>
            <span className="shrink-0 text-xs text-muted">{fmtSize(a.size_bytes)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
