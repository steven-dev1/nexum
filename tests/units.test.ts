import { describe, expect, it } from "vitest";
import { generateUnits } from "@/lib/unit-generator";
import { groupName, naturalCompare, unitFullLabel, unitNumberLabel } from "@/lib/units";

describe("nombres de unidades", () => {
  it("grupo corto → Torre X; descriptivo → tal cual", () => {
    expect(groupName("1")).toBe("Torre 1");
    expect(groupName("A")).toBe("Torre A");
    expect(groupName("Manzana B")).toBe("Manzana B");
    expect(groupName(null)).toBe("Sin torre");
  });
  it("número con dígito → Apto; con letra → tal cual", () => {
    expect(unitNumberLabel("302")).toBe("Apto 302");
    expect(unitNumberLabel("Casa 12")).toBe("Casa 12");
    expect(unitFullLabel({ tower: "2", number: "101" })).toBe("Torre 2 · Apto 101");
    expect(unitFullLabel(null)).toBe("Sin unidad");
  });
  it("ordena de forma natural", () => {
    expect(["10", "2", "1"].sort(naturalCompare)).toEqual(["1", "2", "10"]);
  });
});

describe("generateUnits", () => {
  const base = { mode: "pisos", tower: "1", prefix: "", floorFrom: "1", floorTo: "3", perFloor: "4", style: "piso-consecutivo", numbers: "", floor: "" } as const;

  it("genera unidades por piso", () => {
    const r = generateUnits({ ...base });
    expect("units" in r && r.units).toHaveLength(12);
    if ("units" in r) expect(r.units[0]).toMatchObject({ tower: "1", number: "101", floor: 1 });
  });
  it("valida rangos y el máximo de unidades", () => {
    expect("error" in generateUnits({ ...base, floorFrom: "5", floorTo: "2" })).toBe(true);
    expect("error" in generateUnits({ ...base, floorTo: "200", perFloor: "50" })).toBe(true);
    expect("error" in generateUnits({ ...base, perFloor: "x" })).toBe(true);
  });
  it("acepta una lista libre con rangos", () => {
    const r = generateUnits({ ...base, mode: "lista", numbers: "1-3, 10", floor: "" });
    expect("units" in r && r.units.map((u) => u.number)).toEqual(["1", "2", "3", "10"]);
  });
});
