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
  repeat: { unit: "month", every: 1 },
  ...over,
});

const budget = (items: Item[], over: Partial<Budget> = {}): Budget => ({
  horizonMonths: 3,
  accounts: [{ id: "chq", name: "Chequing", kind: "cash" }],
  balances: [{ account: "chq", date: "2026-01-01", balance: 1000_00 }],
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
    const it2 = item({ start: "2025-11-10", repeat: { unit: "month", every: 2 } });
    expect(expandItem(it2, "2026-01-01", "2026-06-30")).toEqual(["2026-01-10", "2026-03-10", "2026-05-10"]);
  });

  it("returns nothing when the start is after the window", () => {
    expect(expandItem(item({ start: "2027-01-01" }), "2026-01-01", "2026-12-31")).toEqual([]);
  });

  it("handles a one-off", () => {
    const once = item({ start: "2026-03-05", repeat: undefined });
    expect(expandItem(once, "2026-01-01", "2026-12-31")).toEqual(["2026-03-05"]);
    expect(expandItem(once, "2026-04-01", "2026-12-31")).toEqual([]);
  });

  it("repeats every N days and weeks", () => {
    expect(expandItem(item({ start: "2026-01-01", repeat: { unit: "day", every: 10 } }), "2026-01-05", "2026-01-31")).toEqual([
      "2026-01-11",
      "2026-01-21",
      "2026-01-31",
    ]);
    expect(expandItem(item({ start: "2026-01-02", repeat: { unit: "week", every: 2 } }), "2026-01-01", "2026-02-15")).toEqual([
      "2026-01-02",
      "2026-01-16",
      "2026-01-30",
      "2026-02-13",
    ]);
  });

  it("repeats yearly, clamping Feb 29 in non-leap years", () => {
    expect(expandItem(item({ start: "2028-02-29", repeat: { unit: "year", every: 1 } }), "2028-01-01", "2030-12-31")).toEqual([
      "2028-02-29",
      "2029-02-28",
      "2030-02-28",
    ]);
  });

  it("repeats semimonthly on two days, clamped to month-end, from the start date", () => {
    const pay = item({ start: "2026-01-15", repeat: { unit: "semimonthly", days: [15, 31] } });
    expect(expandItem(pay, "2026-01-01", "2026-03-20")).toEqual([
      "2026-01-15",
      "2026-01-31",
      "2026-02-15",
      "2026-02-28",
      "2026-03-15",
    ]);
  });

  it("stops at the end date, inclusive", () => {
    expect(expandItem(item({ end: "2026-03-31" }), "2026-01-01", "2026-12-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });
});

describe("forecast", () => {
  const bal = (f: ReturnType<typeof forecast>, d: string) => f.daily.find((p) => p.date === d)!.balances.chq;

  it("runs end-of-day balances from the real balance over the horizon", () => {
    const f = forecast(
      budget([
        item({ name: "Pay", kind: "income", amount: 500_00, start: "2026-01-15" }),
        item({ name: "Rent", amount: 300_00, start: "2026-01-20" }),
      ]),
      "2026-01-10",
    );
    expect(f.from).toBe("2026-01-10");
    expect(f.to).toBe("2026-04-09");
    expect(bal(f, "2026-01-10")).toBe(1000_00);
    expect(bal(f, "2026-01-15")).toBe(1500_00);
    expect(bal(f, "2026-01-20")).toBe(1200_00);
    expect(bal(f, "2026-04-09")).toBe(1200_00 + 2 * 200_00);
    expect(f.daily).toHaveLength(90);
  });

  it("applies occurrences after a real balance, and treats ones on its date as already in it", () => {
    const f = forecast(
      budget([
        item({ amount: 50_00, start: "2026-01-01", repeat: undefined }), // on the balance date
        item({ amount: 10_00, start: "2026-01-05", repeat: undefined }), // after it, before today
      ]),
      "2026-01-10",
    );
    expect(f.daily[0]!.balances.chq).toBe(990_00);
  });

  it("re-anchors to a later real balance, ignoring everything due on or before it", () => {
    const f = forecast(
      budget([item({ amount: 100_00, start: "2026-01-02", repeat: { unit: "day", every: 1 } })], {
        balances: [
          { account: "chq", date: "2026-01-01", balance: 1000_00 },
          { account: "chq", date: "2026-01-10", balance: 5000_00 },
        ],
      }),
      "2026-01-10",
    );
    expect(bal(f, "2026-01-10")).toBe(5000_00);
    expect(bal(f, "2026-01-11")).toBe(4900_00);
    // Today's occurrence is already in today's real balance, so it isn't counted.
    expect(f.months[0]!.occurrences[0]!.date).toBe("2026-01-11");
  });

  it("ignores occurrences before an account's first real balance", () => {
    const f = forecast(
      budget([item({ amount: 100_00, start: "2026-01-05", repeat: undefined })], {
        balances: [{ account: "chq", date: "2026-01-08", balance: 700_00 }],
      }),
      "2026-01-10",
    );
    expect(bal(f, "2026-01-10")).toBe(700_00);
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

  it("lists each month's occurrences in order with the balance after each", () => {
    const f = forecast(
      budget([
        item({ name: "Rent", amount: 300_00, start: "2026-02-15", repeat: undefined }),
        item({ name: "Pay", kind: "income", amount: 500_00, start: "2026-02-15", repeat: undefined }),
        item({ name: "Phone", amount: 50_00, start: "2026-02-03", repeat: undefined }),
      ]),
      "2026-01-10",
    );
    expect(f.months[1]!.occurrences.map((o) => [o.date, o.name, o.balanceAfter])).toEqual([
      ["2026-02-03", "Phone", 950_00],
      // Same day: income before expenses.
      ["2026-02-15", "Pay", 1450_00],
      ["2026-02-15", "Rent", 1150_00],
    ]);
    expect(f.months[1]!.occurrences[0]).toMatchObject({ category: "Housing", kind: "expense", account: "chq", amount: 50_00 });
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
});
