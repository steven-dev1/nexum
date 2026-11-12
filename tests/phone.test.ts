import { describe, expect, it } from "vitest";
import { templateText, toWhatsAppNumber } from "@/lib/phone";

describe("toWhatsAppNumber", () => {
  it("completa el indicativo de Colombia", () => {
    expect(toWhatsAppNumber("300 123 4567")).toBe("573001234567");
    expect(toWhatsAppNumber("+57 300-123-4567")).toBe("573001234567");
    expect(toWhatsAppNumber("573001234567")).toBe("573001234567");
  });
  it("acepta números internacionales completos", () => {
    expect(toWhatsAppNumber("+1 415 555 2671")).toBe("14155552671");
  });
  it("rechaza lo que no es un celular", () => {
    for (const bad of ["", null, undefined, "123", "6011234567", "abc", "57300"]) {
      expect(toWhatsAppNumber(bad)).toBeNull();
    }
  });
});

describe("templateText", () => {
  it("quita saltos de línea y espacios repetidos", () => {
    expect(templateText("a\n\nb\t c    d", 50)).toBe("a b c d");
  });
  it("recorta al límite con puntos suspensivos", () => {
    const out = templateText("palabra ".repeat(50), 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
  });
});
