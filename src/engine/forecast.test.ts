import { describe, expect, it } from "vitest";
import type { Budget, Item } from "../data/types";
import { expandItem, forecast } from "./forecast";

const item = (over: Partial<Item> = {}): Item => ({
  name: "Rent",
  category: "Housing",
  kind: "expense",
  amount: 100_00,
  account: "chq",
  start: "2026-01-31",
  repeat: { every: 1, unit: "month" },
  ...over,
});

const budget = (items: Item[], over: Partial<Budget> = {}): Budget => ({
  horizonMonths: 3,
  accounts: [{ id: "chq", name: "Chequing", kind: "cash", openingDate: "2026-01-01", openingBalance: 1000_00 }],
  items,
  ...over,
});

describe("expandItem", () => {
  it("repeats monthly from the start date and clamps to month-end without drifting", () => {
    expect(expandItem(item(), "2026-01-01", "2026-05-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("honours every-N-months and the window bounds", () => {
    const it2 = item({ start: "2025-11-10", repeat: { every: 2, unit: "month" } });
    expect(expandItem(it2, "2026-01-01", "2026-06-30")).toEqual(["2026-01-10", "2026-03-10", "2026-05-10"]);
  });

  it("returns nothing when the start is after the window", () => {
    expect(expandItem(item({ start: "2027-01-01" }), "2026-01-01", "2026-12-31")).toEqual([]);
  });
});

describe("forecast", () => {
  it("runs end-of-day balances from the opening balance over the horizon", () => {
    const f = forecast(
      budget([
        item({ name: "Pay", kind: "income", amount: 500_00, start: "2026-01-15" }),
        item({ name: "Rent", amount: 300_00, start: "2026-01-20" }),
      ]),
      "2026-01-10",
    );
    expect(f.from).toBe("2026-01-10");
    expect(f.to).toBe("2026-04-09");
    const bal = (d: string) => f.daily.find((p) => p.date === d)!.balances.chq;
    expect(bal("2026-01-10")).toBe(1000_00);
    expect(bal("2026-01-15")).toBe(1500_00);
    expect(bal("2026-01-20")).toBe(1200_00);
    expect(bal("2026-04-09")).toBe(1200_00 + 2 * 200_00);
    expect(f.daily).toHaveLength(90);
  });

  it("applies occurrences between the opening date and today, but not on the opening date", () => {
    const f = forecast(
      budget([
        item({ amount: 50_00, start: "2026-01-01" }), // on opening date: already in opening balance
        item({ amount: 10_00, start: "2026-01-05" }), // after opening, before today
      ]),
      "2026-01-10",
    );
    expect(f.daily[0]!.balances.chq).toBe(990_00);
  });

  it("rolls up months that overlap the window, with partial first and last months", () => {
    const f = forecast(
      budget([
        item({ name: "Pay", kind: "income", amount: 500_00, start: "2026-01-15" }),
        item({ name: "Rent", amount: 300_00, start: "2026-01-05" }),
      ]),
      "2026-01-10",
    );
    expect(f.months.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    // January: rent on the 5th is before today, so only pay is counted inside the window.
    expect(f.months[0]).toMatchObject({ in: 500_00, out: 0, net: 500_00 });
    expect(f.months[0]!.end.chq).toBe(700_00 + 500_00);
    expect(f.months[1]).toMatchObject({ in: 500_00, out: 300_00, net: 200_00 });
    expect(f.months[3]).toMatchObject({ in: 0, out: 300_00, net: -300_00 }); // Apr 1–9: rent only
    expect(f.months[3]!.end.chq).toBe(f.daily.at(-1)!.balances.chq);
  });

  it("finds the lowest end-of-day balance per account inside the window", () => {
    const f = forecast(
      budget([
        item({ name: "Pay", kind: "income", amount: 900_00, start: "2026-01-28" }),
        item({ name: "Rent", amount: 900_00, start: "2026-01-25" }),
      ]),
      "2026-01-10",
    );
    // Dips to $100 on the 25th of every month; the first dip wins.
    expect(f.lowest.chq).toEqual({ date: "2026-01-25", balance: 100_00 });
  });

  it("keeps the earliest date when the lowest balance repeats", () => {
    const f = forecast(budget([]), "2026-01-10");
    expect(f.lowest.chq).toEqual({ date: "2026-01-10", balance: 1000_00 });
  });
});
