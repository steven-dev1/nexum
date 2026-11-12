import { describe, expect, it } from "vitest";
import { docFromPlain, imagePathsOf, safeLink, sanitizeDoc } from "@/lib/rich-text";

const IMG = "123e4567-e89b-12d3-a456-426614174000.jpg";

describe("safeLink", () => {
  it("acepta https, mailto y tel", () => {
    expect(safeLink("https://ejemplo.com/a")).toBe("https://ejemplo.com/a");
    expect(safeLink("mailto:admin@conjunto.co")).toBe("mailto:admin@conjunto.co");
    expect(safeLink("tel:+573001234567")).toBe("tel:+573001234567");
  });
  it("rechaza esquemas peligrosos o inválidos", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "http://inseguro.com", "ftp://x.co", "no es url", "", null, 5]) {
      expect(safeLink(bad)).toBeNull();
    }
  });
});

describe("sanitizeDoc", () => {
  const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });

  it("conserva formato permitido y calcula el texto plano", () => {
    const out = sanitizeDoc(
      doc([
        { type: "paragraph", content: [{ type: "text", text: "Hola ", marks: [{ type: "bold" }] }, { type: "text", text: "vecinos" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "uno" }] }] }] },
      ]),
    );
    expect(out?.plain).toContain("Hola vecinos");
    expect(out?.plain).toContain("• uno");
  });

  it("quita enlaces peligrosos pero deja el texto", () => {
    const out = sanitizeDoc(
      doc([{ type: "paragraph", content: [{ type: "text", text: "clic", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }]),
    );
    expect(JSON.stringify(out?.doc)).not.toContain("javascript");
    expect(out?.plain).toBe("clic");
  });

  it("descarta nodos desconocidos e imágenes que no son del bucket", () => {
    const out = sanitizeDoc(
      doc([
        { type: "script", content: [] },
        { type: "image", attrs: { path: "https://evil.com/x.jpg" } },
        { type: "image", attrs: { path: IMG } },
      ]),
    );
    expect(out?.images).toEqual([IMG]);
    expect(out?.doc.content).toHaveLength(1);
  });

  it("limita a 10 imágenes", () => {
    const many = Array.from({ length: 12 }, () => ({ type: "image", attrs: { path: IMG } }));
    expect(sanitizeDoc(doc(many))?.images).toHaveLength(10);
  });

  it("rechaza JSON inválido, otra raíz o demasiado grande", () => {
    expect(sanitizeDoc("no es json")).toBeNull();
    expect(sanitizeDoc(JSON.stringify({ type: "paragraph" }))).toBeNull();
    expect(sanitizeDoc("x".repeat(70_000))).toBeNull();
    expect(sanitizeDoc("")).toBeNull();
  });
});

describe("docFromPlain / imagePathsOf", () => {
  it("convierte líneas en párrafos", () => {
    const d = docFromPlain("uno\n\ndos");
    expect(d.content).toHaveLength(2);
  });
  it("lista las imágenes de un documento", () => {
    expect(imagePathsOf({ type: "doc", content: [{ type: "image", attrs: { path: IMG } }] })).toEqual([IMG]);
    expect(imagePathsOf(null)).toEqual([]);
  });
});
