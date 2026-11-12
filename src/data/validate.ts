import dayjs from "dayjs";
import type { Account, Budget, Cents, Item } from "./types";

export type ValidationResult = { ok: true; budget: Budget } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).format("YYYY-MM-DD") === v;

/** Dollars (at most 2 decimals) → integer cents, or null if not a clean positive amount. */
const toCents = (v: unknown, allowNegative: boolean): Cents | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (!allowNegative && v <= 0) return null;
  const cents = Math.round(v * 100);
  return Math.abs(v * 100 - cents) < 1e-6 ? cents : null;
};

const isWhole = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Check a hand-edited budget file and convert it to engine types, with path-specific errors. */
export function validateBudget(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);
  const str = (o: Obj, key: string, path: string): string => {
    const v = o[key];
    if (typeof v === "string" && v.trim() !== "") return v;
    err(`${path}.${key}`, "expected text");
    return "";
  };
  const date = (o: Obj, key: string, path: string): string => {
    if (isDate(o[key])) return o[key];
    err(`${path}.${key}`, "expected a real date as YYYY-MM-DD");
    return "";
  };
  const list = (o: Obj, key: string): unknown[] => {
    if (Array.isArray(o[key])) return o[key];
    err(key, "expected a list");
    return [];
  };

  if (!isObj(raw)) return { ok: false, errors: ["(root): expected an object"] };

  let horizonMonths = 12;
  if (raw.horizonMonths !== undefined) {
    if (isWhole(raw.horizonMonths, 1, 36)) horizonMonths = raw.horizonMonths;
    else err("horizonMonths", "expected a whole number from 1 to 36");
  }

  const accounts: Account[] = [];
  const ids = new Set<string>();
  list(raw, "accounts").forEach((a, i) => {
    const p = `accounts[${i}]`;
    if (!isObj(a)) return err(p, "expected an object");
    const id = str(a, "id", p);
    if (id && ids.has(id)) err(`${p}.id`, `duplicate id "${id}"`);
    ids.add(id);
    const name = str(a, "name", p);
    if (a.kind !== "cash") err(`${p}.kind`, 'expected "cash"');
    const openingDate = date(a, "openingDate", p);
    const openingBalance = toCents(a.openingBalance, true);
    if (openingBalance === null) err(`${p}.openingBalance`, "expected a dollar amount with at most 2 decimals");
    accounts.push({ id, name, kind: "cash", openingDate, openingBalance: openingBalance ?? 0 });
  });

  const items: Item[] = [];
  list(raw, "items").forEach((it, i) => {
    const p = `items[${i}]`;
    if (!isObj(it)) return err(p, "expected an object");
    const name = str(it, "name", p);
    const category = it.category === undefined ? "Uncategorized" : str(it, "category", p);
    if (it.kind !== "income" && it.kind !== "expense") err(`${p}.kind`, 'expected "income" or "expense"');
    const amount = toCents(it.amount, false);
    if (amount === null) err(`${p}.amount`, "expected a positive dollar amount with at most 2 decimals");
    const account = str(it, "account", p);
    if (account && !ids.has(account)) err(`${p}.account`, `no account with id "${account}"`);
    const start = date(it, "start", p);
    let every = 1;
    if (!isObj(it.repeat)) err(`${p}.repeat`, 'expected { "every": 1, "unit": "month" }');
    else {
      if (isWhole(it.repeat.every, 1, 120)) every = it.repeat.every;
      else err(`${p}.repeat.every`, "expected a whole number from 1 to 120");
      if (it.repeat.unit !== "month") err(`${p}.repeat.unit`, 'expected "month"');
    }
    items.push({
      name,
      category,
      kind: it.kind === "income" ? "income" : "expense",
      amount: amount ?? 0,
      account,
      start,
      repeat: { every, unit: "month" },
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true, budget: { horizonMonths, accounts, items } };
}
