import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateBudget } from "./validate";

// Loosely typed on purpose: tests poke invalid values into it.
const valid = (): any => ({
  horizonMonths: 12,
  accounts: [{ id: "chequing", name: "Chequing", kind: "cash" }],
  balances: [{ account: "chequing", date: "2026-11-01", balance: 1000.5 }],
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
    expect(r.budget.balances[0]!.balance).toBe(100050);
    expect(r.budget.items[0]!.amount).toBe(250000);
  });

  it("defaults horizon to 12, category to Uncategorized, and every to 1", () => {
    const raw = valid();
    delete raw.horizonMonths;
    delete raw.items[0].category;
    raw.items[0].repeat = { unit: "week" };
    const r = validateBudget(raw);
    expect(r.ok && r.budget.horizonMonths).toBe(12);
    expect(r.ok && r.budget.items[0]!.category).toBe("Uncategorized");
    expect(r.ok && r.budget.items[0]!.repeat).toEqual({ unit: "week", every: 1 });
  });

  it("treats a missing repeat as a one-off", () => {
    const raw = valid();
    delete raw.items[0].repeat;
    const r = validateBudget(raw);
    expect(r.ok && r.budget.items[0]!.repeat).toBeUndefined();
  });

  it("accepts semimonthly days and an end date", () => {
    const raw = valid();
    raw.items[0].repeat = { unit: "semimonthly", days: [1, 15] };
    raw.items[0].end = "2027-06-30";
    const r = validateBudget(raw);
    expect(r.ok && r.budget.items[0]).toMatchObject({ repeat: { unit: "semimonthly", days: [1, 15] }, end: "2027-06-30" });
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
    raw.balances[0].date = "2026-02-30";
    raw.items[0].amount = -5;
    raw.items[0].account = "nope";
    raw.items[0].start = "15/11/2026";
    expect(errorsFor(raw)).toEqual([
      "horizonMonths: expected a whole number from 1 to 36",
      "balances[0].date: expected a real date as YYYY-MM-DD",
      "items[0].amount: expected a positive dollar amount with at most 2 decimals",
      'items[0].account: no account with id "nope"',
      "items[0].start: expected a real date as YYYY-MM-DD",
    ]);
  });

  it("rejects amounts with more than 2 decimals", () => {
    const raw = valid();
    raw.items[0].amount = 10.005;
    expect(errorsFor(raw)).toEqual(["items[0].amount: expected a positive dollar amount with at most 2 decimals"]);
  });

  it("rejects duplicate ids and unknown kinds", () => {
    const raw = valid();
    raw.accounts.push({ ...raw.accounts[0] });
    raw.items[0].kind = "gift";
    raw.items[0].id = "pay";
    raw.items.push({ ...raw.items[0], kind: "income" });
    expect(errorsFor(raw)).toEqual([
      'accounts[1].id: duplicate id "chequing"',
      'items[0].kind: expected one of "income", "expense", "transfer"',
      'items[1].id: duplicate id "pay"',
    ]);
  });

  it("needs a real balance for every account, at most one per day", () => {
    const raw = valid();
    raw.accounts.push({ id: "savings", name: "Savings", kind: "cash" });
    raw.balances.push({ ...raw.balances[0] });
    expect(errorsFor(raw)).toEqual([
      'balances[1]: second balance for "chequing" on 2026-11-01',
      'balances: account "savings" needs at least one real balance to start from',
    ]);
  });

  it("rejects bad repeats and an end before the start", () => {
    const raw = valid();
    raw.items[0].repeat = { every: 2, unit: "fortnight" };
    raw.items[0].end = "2026-01-01";
    raw.items.push({ ...raw.items[0], end: undefined, repeat: { unit: "semimonthly", days: [15, 1] } });
    raw.items.push({ ...raw.items[0], end: undefined, repeat: { unit: "month", every: 0 } });
    expect(errorsFor(raw)).toEqual([
      "items[0].end: is before start",
      'items[0].repeat.unit: expected one of "day", "week", "month", "year", "semimonthly"',
      "items[1].repeat.days: expected two days of the month in order, e.g. [1, 15]",
      "items[2].repeat.every: expected a whole number from 1 to 400",
    ]);
  });

  it("stores a debt's real balance as a negative value", () => {
    const raw = valid();
    raw.accounts.push({ id: "mtg", name: "Mortgage", kind: "debt" });
    raw.balances.push({ account: "mtg", date: "2026-11-01", balance: 412000 });
    const r = validateBudget(raw);
    expect(r.ok && r.budget.balances[1]!.balance).toBe(-41200000);
    raw.balances[1].balance = 0; // e.g. an unused HELOC
    expect(validateBudget(raw).ok).toBe(true);
  });

  it("checks account kinds, debt balances and transfer destinations", () => {
    const raw = valid();
    raw.accounts.push({ id: "mtg", name: "Mortgage", kind: "loan" });
    raw.accounts.push({ id: "heloc", name: "HELOC", kind: "debt" });
    raw.balances.push({ account: "mtg", date: "2026-11-01", balance: 1 });
    raw.balances.push({ account: "heloc", date: "2026-11-01", balance: -5 });
    raw.items.push({ ...raw.items[0], kind: "transfer" });
    raw.items.push({ ...raw.items[0], kind: "transfer", to: "chequing" });
    raw.items.push({ ...raw.items[0], to: "heloc" });
    expect(errorsFor(raw)).toEqual([
      'accounts[1].kind: expected one of "cash", "investment", "debt"',
      "balances[2].balance: expected the amount owed, as a positive dollar amount",
      "items[1].to: expected text",
      "items[2].to: must be a different account",
      "items[3].to: only transfers have a destination account",
    ]);
  });
});

