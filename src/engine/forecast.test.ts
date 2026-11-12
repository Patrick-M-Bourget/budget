import { describe, expect, it } from "vitest";
import type { Budget, Item } from "../data/types";
import { expandItem, forecast, periodicRate } from "./forecast";

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

  describe("accounts and transfers", () => {
    const multi = (items: Item[], extra: Partial<Budget> = {}): Budget =>
      budget(items, {
        accounts: [
          { id: "chq", name: "Chequing", kind: "cash" },
          { id: "sav", name: "Savings", kind: "cash" },
          { id: "rrsp", name: "RRSP", kind: "investment" },
          { id: "mtg", name: "Mortgage", kind: "debt" },
        ],
        balances: [
          { account: "chq", date: "2026-01-01", balance: 1000_00 },
          { account: "sav", date: "2026-01-01", balance: 5000_00 },
          { account: "rrsp", date: "2026-01-01", balance: 20000_00 },
          { account: "mtg", date: "2026-01-01", balance: -300000_00 }, // owed $300k
        ],
        ...extra,
      });
    const day = (f: ReturnType<typeof forecast>, d: string) => f.daily.find((p) => p.date === d)!;

    it("moves money between accounts without changing net worth", () => {
      const f = forecast(
        multi([
          item({ name: "TFSA", kind: "transfer", amount: 200_00, account: "chq", to: "sav", start: "2026-01-15" }),
          item({ name: "RRSP", kind: "transfer", amount: 100_00, account: "chq", to: "rrsp", start: "2026-01-15" }),
        ]),
        "2026-01-10",
      );
      const before = day(f, "2026-01-14"), after = day(f, "2026-01-15");
      expect(after.balances).toMatchObject({ chq: 700_00, sav: 5200_00, rrsp: 20100_00 });
      expect(after.totals.netWorth).toBe(before.totals.netWorth);
      expect(after.totals).toEqual({ cash: 5900_00, investment: 20100_00, debt: 300000_00, netWorth: -274000_00 });
    });

    it("pays down a debt with a transfer into it", () => {
      const f = forecast(
        multi([item({ name: "Prepay", kind: "transfer", amount: 1000_00, account: "chq", to: "mtg", start: "2026-01-15", repeat: undefined })]),
        "2026-01-10",
      );
      expect(day(f, "2026-01-15").totals.debt).toBe(299000_00);
      expect(day(f, "2026-01-15").balances.mtg).toBe(-299000_00);
    });

    it("leaves transfers out of in/out but lists them, ordered between income and expenses", () => {
      const f = forecast(
        multi([
          item({ name: "Bill", amount: 50_00, start: "2026-02-01", repeat: undefined }),
          item({ name: "Save", kind: "transfer", amount: 100_00, account: "chq", to: "sav", start: "2026-02-01", repeat: undefined }),
          item({ name: "Pay", kind: "income", amount: 500_00, start: "2026-02-01", repeat: undefined }),
        ]),
        "2026-01-10",
      );
      const feb = f.months[1]!;
      expect(feb).toMatchObject({ in: 500_00, out: 50_00, net: 450_00 });
      expect(feb.occurrences.map((o) => [o.name, o.to, o.balanceAfter])).toEqual([
        ["Pay", undefined, 1500_00],
        ["Save", "sav", 1400_00],
        ["Bill", undefined, 1350_00],
      ]);
      expect(feb.endTotals.cash).toBe(1350_00 + 5100_00);
    });

    it("applies only the side of a transfer that has no real balance that day", () => {
      const f = forecast(
        multi([item({ kind: "transfer", amount: 100_00, account: "chq", to: "sav", start: "2026-01-10", repeat: undefined })], {
          balances: [
            { account: "chq", date: "2026-01-01", balance: 1000_00 },
            { account: "sav", date: "2026-01-10", balance: 7000_00 }, // already includes the transfer
            { account: "rrsp", date: "2026-01-01", balance: 0 },
            { account: "mtg", date: "2026-01-01", balance: 0 },
          ],
        }),
        "2026-01-10",
      );
      expect(day(f, "2026-01-10").balances).toMatchObject({ chq: 900_00, sav: 7000_00 });
    });

    it("tracks the lowest balance for cash accounts only", () => {
      const f = forecast(multi([]), "2026-01-10");
      expect(Object.keys(f.lowest).sort()).toEqual(["chq", "sav"]);
    });
  });

  describe("mortgage", () => {
    const withMortgage = (over: Partial<NonNullable<Budget["accounts"][number]["mortgage"]>> = {}, items: Item[] = []): Budget =>
      budget(items, {
        horizonMonths: 13,
        accounts: [
          { id: "chq", name: "Chequing", kind: "cash" },
          {
            id: "mtg",
            name: "Mortgage",
            kind: "debt",
            mortgage: { ratePercent: 5, payment: 2326_42, frequency: "monthly", firstPayment: "2026-02-01", paidFrom: "chq", renewal: "2026-09-01", ...over },
          },
        ],
        balances: [
          { account: "chq", date: "2026-01-01", balance: 50000_00 },
          { account: "mtg", date: "2026-01-01", balance: -400000_00 },
        ],
      });
    const owedOn = (f: ReturnType<typeof forecast>, d: string) => -f.daily.find((p) => p.date === d)!.balances.mtg!;

    it("uses Canadian semi-annual compounding for the per-payment rate", () => {
      expect(periodicRate(5, "monthly")).toBeCloseTo(0.0041239155, 9);
      expect(periodicRate(5, "biweekly")).toBeCloseTo(0.0019012368, 9);
      expect(periodicRate(5, "accelerated-weekly")).toBe(periodicRate(5, "weekly"));
    });

    it("splits each payment into interest (spending) and principal (paydown)", () => {
      const f = forecast(withMortgage(), "2026-01-10");
      const feb = f.months[1]!;
      expect(feb.occurrences.map((o) => [o.name, o.kind, o.amount])).toEqual([
        ["Mortgage interest", "expense", 1649_57], // hand-checked: 400,000 × 0.0041239155
        ["Mortgage principal", "transfer", 2326_42 - 1649_57],
      ]);
      expect(feb.out).toBe(1649_57);
      expect(owedOn(f, "2026-02-01")).toBe(400000_00 - (2326_42 - 1649_57));
      expect(f.daily.find((p) => p.date === "2026-02-01")!.balances.chq).toBe(50000_00 - 2326_42);
    });

    it("matches the closed-form amortization within $1 after 12 payments", () => {
      // B12 = B0(1+i)^12 − P((1+i)^12 − 1)/i = 391,690.97 for B0 = 400,000, 5%, P = 2,326.42
      const f = forecast(withMortgage(), "2026-01-10");
      expect(Math.abs(owedOn(f, "2027-01-01") - 391690_97)).toBeLessThanOrEqual(100);
    });

    it("takes a prepayment fully off the principal, lowering later interest", () => {
      const prepay = item({ name: "Prepay", kind: "transfer", amount: 10000_00, account: "chq", to: "mtg", start: "2026-01-15", repeat: undefined });
      const f = forecast(withMortgage({}, [prepay]), "2026-01-10");
      expect(owedOn(f, "2026-01-15")).toBe(390000_00);
      expect(f.months[1]!.occurrences[0]!.amount).toBe(Math.round(390000_00 * periodicRate(5, "monthly")));
    });

    it("pays biweekly and stops once the mortgage is paid off", () => {
      const f = forecast(
        budget([], {
          horizonMonths: 2,
          accounts: [
            { id: "chq", name: "Chequing", kind: "cash" },
            { id: "mtg", name: "Mortgage", kind: "debt", mortgage: { ratePercent: 0, payment: 400_00, frequency: "biweekly", firstPayment: "2026-01-12", paidFrom: "chq" } },
          ],
          balances: [
            { account: "chq", date: "2026-01-01", balance: 5000_00 },
            { account: "mtg", date: "2026-01-01", balance: -1000_00 },
          ],
        }),
        "2026-01-10",
      );
      const pays = f.months.flatMap((m) => m.occurrences).map((o) => [o.date, o.amount]);
      expect(pays).toEqual([
        ["2026-01-12", 400_00],
        ["2026-01-26", 400_00],
        ["2026-02-09", 200_00], // final payment is only what's left
      ]);
      expect(f.daily.at(-1)!.totals.debt).toBe(0);
    });

    it("marks the renewal date inside the window", () => {
      expect(forecast(withMortgage(), "2026-01-10").markers).toEqual([{ date: "2026-09-01", label: "Mortgage renewal" }]);
      expect(forecast(withMortgage({ renewal: "2030-01-01" }), "2026-01-10").markers).toEqual([]);
    });
  });
});

