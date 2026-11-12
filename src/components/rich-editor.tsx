"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef, useState, type ReactNode } from "react";
import { richCls } from "@/components/rich-text-classes";
import { labelCls } from "@/components/ui";
import { compressImage } from "@/lib/compress-image";
import { IMAGE_BUCKET, safeLink, type RichNode } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/client";

/** Imagen que guarda la ruta del archivo en el bucket privado (la URL firmada solo sirve para mostrarla). */
const StoredImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), path: { default: null } };
  },
});

/** Pone a cada imagen guardada su URL firmada para poder verla dentro del editor. */
function withUrls(node: RichNode, urls: Record<string, string>): RichNode {
  if (node.type === "image" && typeof node.attrs?.path === "string") {
    return { ...node, attrs: { ...node.attrs, src: urls[node.attrs.path] ?? "" } };
  }
  return node.content ? { ...node, content: node.content.map((c) => withUrls(c, urls)) } : node;
}

type Props = {
  /** Nombre del campo oculto que viaja en el formulario con el documento en JSON. */
  name: string;
  label?: string;
  initialDoc?: RichNode | null;
  /** URL firmada de cada imagen del documento inicial (ruta → URL). */
  imageUrls?: Record<string, string>;
};

const btn =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Editor de texto enriquecido (negrita, cursiva, títulos, listas, cita, enlaces e imágenes).
 * El documento viaja como JSON en un campo oculto; el servidor lo valida y lo limpia antes de guardarlo.
 */
export function RichEditor({ name, label = "Mensaje", initialDoc, imageUrls = {} }: Props) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, defaultProtocol: "https", protocols: ["mailto", "tel"] },
        strike: false,
        code: false,
        codeBlock: false,
      }),
      StoredImage.configure({ inline: false }),
    ],
    content: initialDoc ? withUrls(initialDoc, imageUrls) : undefined,
    editorProps: {
      attributes: {
        class: `${richCls} min-h-40 max-h-[55vh] overflow-y-auto px-3.5 py-3 focus:outline-none`,
        "aria-label": label,
      },
    },
    onCreate: ({ editor: e }) => {
      if (fieldRef.current) fieldRef.current.value = JSON.stringify(e.getJSON());
    },
    onUpdate: ({ editor: e }) => {
      if (fieldRef.current) fieldRef.current.value = JSON.stringify(e.getJSON());
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      quote: e?.isActive("blockquote") ?? false,
      link: e?.isActive("link") ?? false,
    }),
  });

  async function uploadImage(file: File) {
    if (!editor) return;
    setUploading(true);
    setError(null);
    try {
      const jpeg = await compressImage(file, "comunicado.jpg");
      const path = `${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, jpeg, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, 3600);
      if (signed.error) throw signed.error;
      editor.chain().focus().setImage({ src: signed.data.signedUrl, alt: "" }).updateAttributes("image", { path }).run();
    } catch {
      setError("No se pudo subir la imagen. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  function openLink() {
    if (!editor) return;
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(false);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const raw = linkValue.trim();
    if (!raw) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const href = safeLink(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!href) {
      setLinkError(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  }

  const tool = (title: string, active: boolean, run: () => void, content: ReactNode) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={!editor}
      onClick={run}
      className={`${btn} ${active ? "bg-primary-soft text-primary-ink" : ""}`}
    >
      {content}
    </button>
  );

  const svg = (d: ReactNode) => (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d}
    </svg>
  );

  return (
    <div>
      <span className={labelCls}>{label}</span>
      <input ref={fieldRef} type="hidden" name={name} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadImage(file);
        }}
      />

      <div className="overflow-hidden rounded-xl border border-line bg-bg transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface px-1.5 py-1">
          {tool("Negrita", state?.bold ?? false, () => editor?.chain().focus().toggleBold().run(), <span className="font-bold">B</span>)}
          {tool("Cursiva", state?.italic ?? false, () => editor?.chain().focus().toggleItalic().run(), <span className="italic">I</span>)}
          {tool("Título", state?.h2 ?? false, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), <span>H</span>)}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {tool(
            "Lista con viñetas",
            state?.bullet ?? false,
            () => editor?.chain().focus().toggleBulletList().run(),
            svg(<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />),
          )}
          {tool(
            "Lista numerada",
            state?.ordered ?? false,
            () => editor?.chain().focus().toggleOrderedList().run(),
            svg(<path d="M10 6h11M10 12h11M10 18h11M4 7V4l-1 1M3 14h2l-2 3h2" />),
          )}
          {tool(
            "Cita",
            state?.quote ?? false,
            () => editor?.chain().focus().toggleBlockquote().run(),
            svg(<path d="M4 6v12M9 8h11M9 12h11M9 16h7" />),
          )}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {tool(
            "Enlace",
            state?.link ?? false,
            openLink,
            svg(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />),
          )}
          <button
            type="button"
            title="Insertar imagen"
            aria-label="Insertar imagen"
            disabled={!editor || uploading}
            onClick={() => fileRef.current?.click()}
            className={btn}
          >
            {uploading ? (
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-line border-t-primary" />
            ) : (
              svg(
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </>,
              )
            )}
          </button>
        </div>

        {linkOpen && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-2.5 py-2">
            <input
              value={linkValue}
              onChange={(e) => {
                setLinkValue(e.target.value);
                setLinkError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setLinkOpen(false);
                }
              }}
              placeholder="https://ejemplo.com"
              aria-label="Dirección del enlace"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-base text-ink focus:border-primary focus:outline-none sm:text-sm"
            />
            <button type="button" onClick={applyLink} className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary hover:bg-primary-hover">
              Aplicar
            </button>
            <button type="button" onClick={() => setLinkOpen(false)} className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink">
              Cancelar
            </button>
            {linkError && <p className="basis-full text-xs text-danger">Usa un enlace https://, un correo (mailto:) o un teléfono (tel:).</p>}
          </div>
        )}

        <EditorContent editor={editor} />
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-1.5 text-xs text-muted">Puedes dar formato, agregar enlaces e insertar imágenes (máx. 10).</p>
    </div>
  );
}
