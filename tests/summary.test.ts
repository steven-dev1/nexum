import { describe, expect, it } from "vitest";
import { barHeight, parseSummary, percent, shortDay } from "@/lib/summary";

describe("parseSummary", () => {
  it("lee la respuesta completa", () => {
    const s = parseSummary({
      days: 7,
      users: { residents: 40, staff: 3, without_unit: 2, units: 50, units_with_residents: 38, active_invitations: 1 },
      packages: { pending: 4, received: 12, delivered: 9 },
      announcements: { published: 3, scheduled: 1, drafts: 2, read_rate: 0.62 },
      reservations: { today: 2, upcoming: 5 },
      polls: { open: [{ id: "p1", question: "¿Aprueba?", closes_at: null, voted: 10, total: 38 }] },
      access: { vehicles_inside: 6, movements_today: 14, denied: 1 },
      visits: { inside: 2, waiting: 1, authorized: 3, period: 11 },
      series: [{ day: "2026-11-13", packages: 2, access: 5, visits: 1 }],
    })!;
    expect(s.users.withoutUnit).toBe(2);
    expect(s.packages.pending).toBe(4);
    expect(s.polls[0]).toMatchObject({ question: "¿Aprueba?", voted: 10, total: 38 });
    expect(s.series).toHaveLength(1);
  });

  it("tolera respuestas incompletas o nulas", () => {
    expect(parseSummary(null)).toBeNull();
    const s = parseSummary({})!;
    expect(s.days).toBe(7);
    expect(s.packages.pending).toBe(0);
    expect(s.polls).toEqual([]);
    expect(s.series).toEqual([]);
  });
});

describe("utilidades", () => {
  it("percent", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(5, 0)).toBe(0);
    expect(percent(9, 3)).toBe(100);
  });
  it("shortDay", () => {
    expect(shortDay("2026-11-13")).toBe("13 nov");
    expect(shortDay("2026-01-02")).toBe("2 ene");
  });
  it("barHeight deja visibles los valores pequeños", () => {
    expect(barHeight(0, 10)).toBe(0);
    expect(barHeight(1, 100)).toBe(6);
    expect(barHeight(10, 10)).toBe(100);
    expect(barHeight(5, 0)).toBe(0);
  });
});
