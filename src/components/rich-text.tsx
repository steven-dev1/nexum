import type { ReactNode } from "react";
import { richCls } from "@/components/rich-text-classes";
import { safeLink, type RichNode } from "@/lib/rich-text";

/**
 * Muestra un documento de comunicado como elementos de React (nunca HTML en crudo).
 * Los enlaces se vuelven a validar al pintar y las imágenes salen de `urls` (ruta → URL firmada).
 */
export function RichText({ doc, urls }: { doc: RichNode; urls: Record<string, string> }) {
  return <div className={richCls}>{(doc.content ?? []).map((n, i) => renderNode(n, i, urls))}</div>;
}

function renderNode(node: RichNode, key: number, urls: Record<string, string>): ReactNode {
  const children = (node.content ?? []).map((c, i) => renderNode(c, i, urls));

  switch (node.type) {
    case "text": {
      let out: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") out = <strong>{out}</strong>;
        else if (mark.type === "italic") out = <em>{out}</em>;
        else if (mark.type === "link") {
          const href = safeLink(mark.attrs?.href);
          if (href) {
            out = (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {out}
              </a>
            );
          }
        }
      }
      return <span key={key}>{out}</span>;
    }
    case "hardBreak":
      return <br key={key} />;
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading":
      return node.attrs?.level === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>;
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "horizontalRule":
      return <hr key={key} />;
    case "image": {
      const src = urls[String(node.attrs?.path)];
      // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, de corta duración
      return src ? <img key={key} src={src} alt="Imagen del comunicado" loading="lazy" /> : null;
    }
    default:
      return null;
  }
}
