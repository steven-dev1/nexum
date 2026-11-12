/**
 * Texto enriquecido de los comunicados.
 *
 * Se guarda como JSON (documento de Tiptap), nunca como HTML. Antes de guardarlo, el servidor lo
 * reconstruye con una lista blanca de nodos y marcas (`sanitizeDoc`): así, aunque alguien envíe un
 * JSON manipulado, no puede colar enlaces `javascript:`, imágenes externas ni nodos desconocidos.
 */

export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export const IMAGE_BUCKET = "announcement-images";
/** Nombre de archivo que genera la app para las imágenes: `<uuid>.jpg`. */
export const IMAGE_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

const MAX_JSON_CHARS = 60_000;
const MAX_DEPTH = 8;
const MAX_IMAGES = 10;
const SAFE_LINK_PROTOCOLS = ["https:", "mailto:", "tel:"];

const BLOCKS = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "image"]);
const MARKS = new Set(["bold", "italic", "link"]);

/** Devuelve la URL si es un enlace permitido (https, mailto o tel); si no, null. */
export function safeLink(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const value = href.trim();
  if (!value || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return SAFE_LINK_PROTOCOLS.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function sanitizeNode(node: unknown, depth: number, images: string[]): RichNode | null {
  if (depth > MAX_DEPTH || typeof node !== "object" || node === null) return null;
  const n = node as RichNode;

  if (n.type === "text") {
    const text = typeof n.text === "string" ? n.text : "";
    if (!text) return null;
    const marks: NonNullable<RichNode["marks"]> = [];
    for (const m of Array.isArray(n.marks) ? n.marks : []) {
      if (!m || !MARKS.has(m.type)) continue;
      if (m.type === "link") {
        const href = safeLink(m.attrs?.href);
        if (href) marks.push({ type: "link", attrs: { href } });
      } else {
        marks.push({ type: m.type });
      }
    }
    return marks.length ? { type: "text", text, marks } : { type: "text", text };
  }

  if (n.type === "hardBreak") return { type: "hardBreak" };
  if (!BLOCKS.has(n.type)) return null;

  if (n.type === "image") {
    const path = n.attrs?.path;
    if (typeof path !== "string" || !IMAGE_PATH_RE.test(path) || images.length >= MAX_IMAGES) return null;
    images.push(path);
    return { type: "image", attrs: { path } };
  }
  if (n.type === "horizontalRule") return { type: "horizontalRule" };

  const children = (Array.isArray(n.content) ? n.content : [])
    .map((c) => sanitizeNode(c, depth + 1, images))
    .filter((c): c is RichNode => c !== null);

  const out: RichNode = { type: n.type };
  if (n.type === "heading") {
    const level = Number(n.attrs?.level);
    out.attrs = { level: level === 3 ? 3 : 2 };
  }
  if (n.type === "orderedList") out.attrs = { start: 1 };
  if (children.length) out.content = children;
  return out;
}

/** Valida y limpia el JSON recibido del navegador. Devuelve null si no es un documento válido. */
export function sanitizeDoc(raw: string): { doc: RichNode; images: string[]; plain: string } | null {
  if (!raw || raw.length > MAX_JSON_CHARS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const root = parsed as RichNode;
  if (!root || root.type !== "doc" || !Array.isArray(root.content)) return null;

  const images: string[] = [];
  const content = root.content
    .map((c) => sanitizeNode(c, 1, images))
    .filter((c): c is RichNode => c !== null);
  const doc: RichNode = { type: "doc", content };
  return { doc, images, plain: toPlainText(doc) };
}

/** Texto plano del documento (para notificaciones, búsquedas y como respaldo). */
export function toPlainText(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const inner = (node.content ?? []).map(toPlainText);
  switch (node.type) {
    case "doc":
      return inner.join("\n").trim();
    case "bulletList":
    case "orderedList":
      return inner.join("\n");
    case "listItem":
      return `• ${inner.join(" ")}`;
    case "image":
      return "";
    default:
      return inner.join("");
  }
}

/** Convierte texto plano (comunicados antiguos) en un documento: un párrafo por línea. */
export function docFromPlain(text: string): RichNode {
  const paragraphs = text.split(/\n{1,}/).map((line) => line.trim());
  return {
    type: "doc",
    content: paragraphs
      .filter(Boolean)
      .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
  };
}

/** Rutas de imágenes usadas por un documento ya guardado. */
export function imagePathsOf(doc: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as RichNode;
    if (node.type === "image" && typeof node.attrs?.path === "string") out.push(node.attrs.path);
    node.content?.forEach(walk);
  };
  walk(doc);
  return out;
}
