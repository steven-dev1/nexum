import { describe, expect, it } from "vitest";
import { cleanContext, isKind, isStatus, isTarget, validateTicket, webhookPayload } from "@/lib/support";

describe("validateTicket", () => {
  it("acepta una solicitud razonable", () => {
    expect(validateTicket("No carga", "La página se queda en blanco")).toBeNull();
  });
  it("rechaza asuntos o mensajes vacíos o muy largos", () => {
    expect(validateTicket("ab", "mensaje largo")).toMatch(/asunto/i);
    expect(validateTicket("   ", "mensaje largo")).toMatch(/asunto/i);
    expect(validateTicket("Asunto", "hola")).toMatch(/detalle/i);
    expect(validateTicket("x".repeat(141), "mensaje largo")).toMatch(/140/);
    expect(validateTicket("Asunto", "y".repeat(4001))).toMatch(/4000/);
  });
});

describe("validadores de valores", () => {
  it("solo aceptan los valores permitidos", () => {
    expect(isKind("problema")).toBe(true);
    expect(isKind("otra")).toBe(false);
    expect(isTarget("soporte_tecnico")).toBe(true);
    expect(isTarget("alguien")).toBe(false);
    expect(isStatus("resuelta")).toBe(true);
    expect(isStatus("cerrada")).toBe(false);
  });
});

describe("cleanContext", () => {
  it("recorta y limpia lo que manda el navegador", () => {
    const c = cleanContext({ page: "/paqueteria?x=1", ua: "Mozilla\n\u0000/5.0 ".repeat(100), viewport: "390x844" }, { role: "residente", version: "ab12" });
    expect(c.page).toBe("/paqueteria?x=1");
    expect(c.device.length).toBeLessThanOrEqual(300);
    expect(c.device).not.toMatch(/[\u0000-\u001f]/);
    expect(c.viewport).toBe("390x844");
    expect(c.role).toBe("residente");
  });
  it("descarta rutas que no empiezan por / y tamaños mal formados", () => {
    expect(cleanContext({ page: "https://evil.com", viewport: "ancho x alto" }).page).toBe("");
    expect(cleanContext({ viewport: "ancho x alto" }).viewport).toBe("");
    expect(cleanContext({ page: 5, ua: null }).device).toBe("");
  });
});

describe("webhookPayload", () => {
  it("arma el aviso sin datos de contacto", () => {
    const p = webhookPayload({
      id: "t1", kind: "problema", subject: "No carga", body: "Se queda en blanco", who: "Ana · Torre 1 Apto 101",
      context: cleanContext({ page: "/reservas", ua: "Chrome" }), site: "https://nexum.app/",
    });
    expect(p.text).toContain("No carga");
    expect(p.text).toContain("Sección: /reservas");
    expect(p.text).toContain("https://nexum.app/admin/soporte");
    expect(p.content).toBe(p.text);
  });
});
