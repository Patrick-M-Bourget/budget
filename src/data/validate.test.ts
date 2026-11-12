import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateBudget } from "./validate";

const valid = () => ({
  horizonMonths: 12,
  accounts: [
    { id: "chequing", name: "Chequing", kind: "cash", openingDate: "2026-11-01", openingBalance: 1000.5 },
  ],
  items: [
    {
      name: "Pay",
      category: "Income",
      kind: "income",
      amount: 2500,
      account: "chequing",
      start: "2026-11-15",
      repeat: { every: 1, unit: "month" },
    },
  ],
});

const errorsFor = (raw: unknown) => {
  const r = validateBudget(raw);
  return r.ok ? [] : r.errors;
};

describe("validateBudget", () => {
  it("accepts a valid budget and converts dollars to integer cents", () => {
    const r = validateBudget(valid());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.budget.accounts[0]!.openingBalance).toBe(100050);
    expect(r.budget.items[0]!.amount).toBe(250000);
  });

  it("defaults horizon to 12 months and category to Uncategorized", () => {
    const raw: Record<string, unknown> = valid();
    delete raw.horizonMonths;
    delete (raw.items as Record<string, unknown>[])[0]!.category;
    const r = validateBudget(raw);
    expect(r.ok && r.budget.horizonMonths).toBe(12);
    expect(r.ok && r.budget.items[0]!.category).toBe("Uncategorized");
  });

  it("accepts the example file", () => {
    const raw = JSON.parse(readFileSync(new URL("../../examples/sample.json", import.meta.url), "utf8"));
    expect(errorsFor(raw)).toEqual([]);
  });

  it("rejects a non-object root", () => {
    expect(errorsFor([])).toEqual(["(root): expected an object"]);
  });

  it("reports path-specific errors", () => {
    const raw = valid();
    raw.horizonMonths = 40;
    raw.accounts[0]!.openingDate = "2026-02-30";
    raw.items[0]!.amount = -5;
    raw.items[0]!.account = "nope";
    raw.items[0]!.start = "15/11/2026";
    expect(errorsFor(raw)).toEqual([
      "horizonMonths: expected a whole number from 1 to 36",
      "accounts[0].openingDate: expected a real date as YYYY-MM-DD",
      "items[0].amount: expected a positive dollar amount with at most 2 decimals",
      "items[0].account: no account with id \"nope\"",
      "items[0].start: expected a real date as YYYY-MM-DD",
    ]);
  });

  it("rejects amounts with more than 2 decimals", () => {
    const raw = valid();
    raw.items[0]!.amount = 10.005;
    expect(errorsFor(raw)).toEqual([
      "items[0].amount: expected a positive dollar amount with at most 2 decimals",
    ]);
  });

  it("rejects duplicate account ids and unknown kinds", () => {
    const raw = valid();
    raw.accounts.push({ ...raw.accounts[0]! });
    raw.items[0]!.kind = "gift";
    expect(errorsFor(raw)).toEqual([
      "accounts[1].id: duplicate id \"chequing\"",
      "items[0].kind: expected \"income\" or \"expense\"",
    ]);
  });

  it("only supports monthly repeats for now", () => {
    const raw = valid();
    raw.items[0]!.repeat = { every: 2, unit: "week" };
    expect(errorsFor(raw)).toEqual(["items[0].repeat.unit: expected \"month\""]);
  });
});
