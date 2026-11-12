import { describe, expect, it } from "vitest";
import { inviteReason, tokenFromInput } from "@/lib/invitation-options";

describe("tokenFromInput", () => {
  it("extrae el código de un enlace completo", () => {
    expect(tokenFromInput("https://nexum.app/invitacion/abc_DEF-123")).toBe("abc_DEF-123");
  });
  it("limpia un código suelto", () => {
    expect(tokenFromInput("  abc DEF!123 ")).toBe("abcDEF123");
  });
});

describe("inviteReason", () => {
  it("explica cada motivo y tiene un texto por defecto", () => {
    expect(inviteReason("vencida")).toMatch(/venció/);
    expect(inviteReason("agotada")).toMatch(/máximo/);
    expect(inviteReason("otra_cosa")).toMatch(/No se pudo/);
    expect(inviteReason(null)).toMatch(/No se pudo/);
  });
});
