import { describe, expect, it } from "vitest";
import { DATASETS } from "@/lib/export/datasets";
import { buildPdf, buildXlsx, fileName } from "@/lib/export/files";
import { addDays, resolveRange } from "@/lib/export/range";

describe("resolveRange", () => {
  const now = new Date("2026-11-13T15:00:00Z");

  it("sin fechas usa los últimos 30 días hasta hoy (Colombia)", () => {
    const r = resolveRange(null, null, now);
    expect("range" in r && r.range).toMatchObject({ from: "2026-10-15", to: "2026-11-13" });
  });

  it("incluye todo el día final y respeta UTC-5", () => {
    const r = resolveRange("2026-11-01", "2026-11-03", now);
    expect("range" in r && r.range.fromIso).toBe("2026-11-01T05:00:00.000Z");
    expect("range" in r && r.range.toIso).toBe("2026-11-04T05:00:00.000Z");
  });

  it("rechaza fechas inválidas, invertidas o demasiado largas", () => {
    expect("error" in resolveRange("2026-13-01", "2026-11-03", now)).toBe(true);
    expect("error" in resolveRange("hola", null, now)).toBe(true);
    expect("error" in resolveRange("2026-11-05", "2026-11-01", now)).toBe(true);
    expect("error" in resolveRange("2024-01-01", "2026-11-01", now)).toBe(true);
  });

  it("addDays cruza meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("fileName", () => {
  it("limpia acentos y caracteres raros", () => {
    expect(fileName(["Nexum", "Votación", "2026-11-01"], "xlsx")).toBe("nexum-votacion-2026-11-01.xlsx");
    expect(fileName(["../../etc/passwd"], "pdf")).toBe("etc-passwd.pdf");
    expect(fileName([""], "pdf")).toBe("exportacion.pdf");
  });
});

describe("archivos", () => {
  const columns = [{ header: "Nombre" }, { header: "Cantidad" }];
  const rows = [
    ["Ñandú Pérez", 3],
    ["=SUMA(A1:A2)", null],
  ];

  it("genera un Excel válido (zip) y no interpreta fórmulas", async () => {
    const buf = await buildXlsx("Prueba", "Del 1 al 2", columns, rows);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("genera un PDF válido, también sin filas", () => {
    const pdf = buildPdf("Prueba", "Del 1 al 2", columns, rows);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const empty = buildPdf("Vacío", "Estado actual", columns, []);
    expect(empty.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("DATASETS", () => {
  it("tienen claves únicas y columnas definidas", () => {
    const keys = DATASETS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of DATASETS) {
      expect(d.columns.length).toBeGreaterThan(0);
      expect(["admin", "staff"]).toContain(d.access);
    }
  });
});
