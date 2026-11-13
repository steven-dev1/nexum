import { describe, expect, it } from "vitest";
import { isValidPlate, nearMatches, normalizePlate, parseSpokenCommand, spellPlate } from "@/lib/plate";

describe("placas", () => {
  it("normaliza", () => {
    expect(normalizePlate(" abc-123 ")).toBe("ABC123");
    expect(normalizePlate("ab c 12 d")).toBe("ABC12D");
  });
  it("valida carros y motos", () => {
    expect(isValidPlate("ABC123")).toBe(true);
    expect(isValidPlate("ABC12D")).toBe(true);
    for (const bad of ["AB1234", "ABCD12", "ABC1234", "123ABC", "ABC", "", "abc123"]) expect(isValidPlate(bad)).toBe(false);
  });
  it("la deletrea", () => {
    expect(spellPlate("ABC123")).toBe("A, B, C, 1, 2, 3");
  });
});

describe("parseSpokenCommand", () => {
  const first = (s: string) => parseSpokenCommand([s]);

  it.each([
    ["ingresa placa ABC123", "ABC123"],
    ["Ingresa placa abc 123", "ABC123"],
    ["ingresa placa a b c 1 2 3", "ABC123"],
    ["ingresa placa a be ce uno dos tres", "ABC123"],
    ["ingreso placa alfa bravo charlie 1 2 3", "ABC123"],
    ["ingresa placa efe ge hache cuatro cinco seis", "FGH456"],
    ["ingresa placa ABC12D", "ABC12D"],
    ["ingresa placa a be ce uno dos de", "ABC12D"],
    ["ingresa placa ese te u siete ocho nueve", "STU789"],
    ["por favor ingresa placa x y z 0 0 1", "XYZ001"],
    ["ingresa placa doble ve equis ye cero cero uno", "WXY001"],
    ["ingresa placa jota ele eme cuatro cuatro cuatro", "JLM444"],
  ])("«%s» → %s", (phrase, plate) => {
    expect(first(phrase).plates[0]).toBe(plate);
    expect(first(phrase).direction).toBe("ingreso");
  });

  it("entiende la salida", () => {
    const r = first("sale placa ABC123");
    expect(r.direction).toBe("salida");
    expect(r.plates).toContain("ABC123");
  });

  it.each(["sal placa ABC123", "sali placa ABC123", "salida placa ABC123", "Sale placa a be ce uno dos tres", "retira placa ABC123"])(
    "entiende variantes de salida: %s",
    (phrase) => {
      const r = first(phrase);
      expect(r.direction).toBe("salida");
      expect(r.plates[0]).toBe("ABC123");
    },
  );

  it("sin orden hablada, la dirección queda sin definir", () => {
    const r = first("placa ABC123");
    expect(r.direction).toBeNull();
    expect(r.plates[0]).toBe("ABC123");
  });

  it("corrige confusiones por posición (O por 0, I por 1)", () => {
    expect(first("ingresa placa a b c o 1 2").plates).toContain("ABC012");
    expect(first("ingresa placa a b c 1 o i").plates).toContain("ABC101");
  });

  it("ignora muletillas y caracteres de más", () => {
    expect(first("ingresa placa ABC123 gracias").plates).toContain("ABC123");
  });

  it("usa las alternativas del reconocedor en orden", () => {
    const r = parseSpokenCommand(["ingresa placa ABC 12", "ingresa placa ABC 123", "ingresa placa ABV 123"]);
    expect(r.plates).toEqual(["ABC123", "ABV123"]);
  });

  it("no inventa placas de frases sin placa", () => {
    expect(first("hola buenas tardes").plates).toEqual([]);
    expect(first("ingresa placa").plates).toEqual([]);
    expect(first("ingresa placa uno dos").plates).toEqual([]);
    expect(first("").plates).toEqual([]);
  });
});

describe("nearMatches", () => {
  const known = ["ABC123", "ABV123", "XYZ999", "ABC124"];
  it("sugiere las que difieren en un carácter", () => {
    expect(nearMatches("ABC123", known).sort()).toEqual(["ABC124", "ABV123"]);
  });
  it("no incluye la misma placa ni las muy distintas", () => {
    expect(nearMatches("XYZ999", known)).toEqual([]);
  });
});
