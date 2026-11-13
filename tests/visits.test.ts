import { describe, expect, it } from "vitest";
import {
  isValidCode,
  normalizeCode,
  parseVisitCode,
  qrPayload,
  shareText,
  visitView,
  visitWindow,
  windowTooLong,
} from "@/lib/visits";

describe("códigos", () => {
  it("normaliza y valida", () => {
    expect(normalizeCode(" ab-c 23 4 ")).toBe("ABC234");
    expect(isValidCode("ABC234")).toBe(true);
    // 0, O, 1 e I no existen en el alfabeto
    for (const bad of ["ABC0DE", "ABCOEF", "ABC1DE", "ABCIDE", "ABC23", "ABC2345", "abc234", ""]) {
      expect(isValidCode(bad)).toBe(false);
    }
  });

  it("lee el QR de Nexum, un enlace o el código suelto", () => {
    expect(parseVisitCode(qrPayload("ABC234"))).toBe("ABC234");
    expect(parseVisitCode("nexum-visita: abc-234")).toBe("ABC234");
    expect(parseVisitCode("https://nexum.app/accesos?c=abc234")).toBe("ABC234");
    expect(parseVisitCode("  abc 234 ")).toBe("ABC234");
  });

  it("rechaza lo que no es un código", () => {
    for (const bad of ["", "hola", "NEXUM-VISITA:XYZ", "https://nexum.app/?c=123", "https://otro.com/"]) {
      expect(parseVisitCode(bad)).toBeNull();
    }
  });
});

describe("visitView", () => {
  const now = new Date("2026-11-13T15:00:00Z");
  const at = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();

  it("deduce vencida, programada y esperada de las fechas", () => {
    expect(visitView({ status: "autorizada", valid_from: at(-1), valid_until: at(2) }, now)).toBe("esperada");
    expect(visitView({ status: "autorizada", valid_from: at(1), valid_until: at(3) }, now)).toBe("programada");
    expect(visitView({ status: "autorizada", valid_from: at(-3), valid_until: at(-1) }, now)).toBe("vencida");
    expect(visitView({ status: "por_autorizar", valid_from: at(-3), valid_until: at(-1) }, now)).toBe("vencida");
    expect(visitView({ status: "por_autorizar", valid_from: at(-1), valid_until: at(1) }, now)).toBe("por_autorizar");
  });

  it("los estados finales no cambian con la fecha", () => {
    for (const status of ["dentro", "salio", "rechazada", "cancelada"] as const) {
      expect(visitView({ status, valid_from: at(-9), valid_until: at(-8) }, now)).toBe(status);
    }
  });
});

describe("visitWindow", () => {
  it("arma la ventana en hora de Colombia", () => {
    const w = visitWindow("2026-11-13", "14:00", "18:30");
    expect(w).toEqual({ validFrom: "2026-11-13T19:00:00.000Z", validUntil: "2026-11-13T23:30:00.000Z" });
  });

  it("si la hora final no es posterior, termina al día siguiente", () => {
    const w = visitWindow("2026-11-13", "20:00", "02:00")!;
    expect(w.validFrom).toBe("2026-11-14T01:00:00.000Z");
    expect(w.validUntil).toBe("2026-11-14T07:00:00.000Z");
  });

  it("rechaza formatos inválidos", () => {
    expect(visitWindow("13/11/2026", "14:00", "18:00")).toBeNull();
    expect(visitWindow("2026-11-13", "2pm", "18:00")).toBeNull();
  });

  it("limita la duración de una autorización", () => {
    expect(windowTooLong(visitWindow("2026-11-13", "08:00", "20:00")!)).toBe(false);
    expect(windowTooLong({ validFrom: "2026-11-13T00:00:00Z", validUntil: "2026-11-20T00:00:00Z" })).toBe(true);
  });
});

describe("shareText", () => {
  it("incluye código, vigencia y placa si hay", () => {
    const t = shareText({ name: "Ana", code: "ABC234", until: "hoy 6:00 p. m.", unit: "Torre 1 · Apto 101", plate: "ABC123" });
    expect(t).toContain("Código: ABC234");
    expect(t).toContain("Placa ABC123");
    expect(t).toContain("Torre 1 · Apto 101");
  });
});
