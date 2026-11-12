import dayjs from "dayjs";
import type { Account, AccountKind, Budget, Cents, Item, RealBalance, Repeat } from "./types";

export type ValidationResult = { ok: true; budget: Budget } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).format("YYYY-MM-DD") === v;

/** Dollars (at most 2 decimals) → integer cents, or null if not a clean amount. */
const toCents = (v: unknown, allowNegative: boolean): Cents | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (!allowNegative && v <= 0) return null;
  const cents = Math.round(v * 100);
  return Math.abs(v * 100 - cents) < 1e-6 ? cents : null;
};

const isWhole = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

const ACCOUNT_KINDS: AccountKind[] = ["cash", "investment", "debt"];
const ITEM_KINDS: Item["kind"][] = ["income", "expense", "transfer"];
const quoted = (xs: readonly string[]) => xs.map((x) => `"${x}"`).join(", ");

const UNITS = ["day", "week", "month", "year", "semimonthly"] as const;

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
  const list = (o: Obj, key: string, optional = false): unknown[] => {
    if (Array.isArray(o[key])) return o[key];
    if (!(optional && o[key] === undefined)) err(key, "expected a list");
    return [];
  };
  const accountRef = (o: Obj, key: string, path: string): string => {
    const id = str(o, key, path);
    if (id && !ids.has(id)) err(`${path}.${key}`, `no account with id "${id}"`);
    return id;
  };

  if (!isObj(raw)) return { ok: false, errors: ["(root): expected an object"] };

  let horizonMonths = 12;
  if (raw.horizonMonths !== undefined) {
    if (isWhole(raw.horizonMonths, 1, 36)) horizonMonths = raw.horizonMonths;
    else err("horizonMonths", "expected a whole number from 1 to 36");
  }

  const accounts: Account[] = [];
  const ids = new Set<string>();
  const kinds = new Map<string, AccountKind>();
  list(raw, "accounts").forEach((a, i) => {
    const p = `accounts[${i}]`;
    if (!isObj(a)) return err(p, "expected an object");
    const id = str(a, "id", p);
    if (id && ids.has(id)) err(`${p}.id`, `duplicate id "${id}"`);
    ids.add(id);
    const name = str(a, "name", p);
    const kind = ACCOUNT_KINDS.find((k) => k === a.kind);
    if (!kind) err(`${p}.kind`, `expected one of ${quoted(ACCOUNT_KINDS)}`);
    kinds.set(id, kind ?? "cash");
    accounts.push({ id, name, kind: kind ?? "cash" });
  });

  const balances: RealBalance[] = [];
  const seen = new Set<string>();
  list(raw, "balances").forEach((b, i) => {
    const p = `balances[${i}]`;
    if (!isObj(b)) return err(p, "expected an object");
    const account = accountRef(b, "account", p);
    const d = date(b, "date", p);
    if (seen.has(`${account}|${d}`)) err(p, `second balance for "${account}" on ${d}`);
    seen.add(`${account}|${d}`);
    const isDebt = kinds.get(account) === "debt";
    // Debts are entered as the amount owed: zero or more.
    const balance = isDebt && typeof b.balance === "number" && b.balance < 0 ? null : toCents(b.balance, true);
    if (balance === null)
      err(`${p}.balance`, isDebt ? "expected the amount owed, as a positive dollar amount" : "expected a dollar amount with at most 2 decimals");
    // A debt's value is what you owe, negated, so net worth is a plain sum.
    balances.push({ account, date: d, balance: isDebt ? -(balance ?? 0) : (balance ?? 0) });
  });
  for (const a of accounts)
    if (a.id && !balances.some((b) => b.account === a.id))
      err("balances", `account "${a.id}" needs at least one real balance to start from`);

  const items: Item[] = [];
  const itemIds = new Set<string>();
  list(raw, "items").forEach((it, i) => {
    const p = `items[${i}]`;
    if (!isObj(it)) return err(p, "expected an object");
    let id: string | undefined;
    if (it.id !== undefined) {
      id = str(it, "id", p);
      if (id && itemIds.has(id)) err(`${p}.id`, `duplicate id "${id}"`);
      itemIds.add(id);
    }
    const name = str(it, "name", p);
    const category = it.category === undefined ? "Uncategorized" : str(it, "category", p);
    const kind = ITEM_KINDS.find((k) => k === it.kind);
    if (!kind) err(`${p}.kind`, `expected one of ${quoted(ITEM_KINDS)}`);
    const amount = toCents(it.amount, false);
    if (amount === null) err(`${p}.amount`, "expected a positive dollar amount with at most 2 decimals");
    const account = accountRef(it, "account", p);
    let to: string | undefined;
    if (kind === "transfer") {
      to = accountRef(it, "to", p);
      if (to && to === account) err(`${p}.to`, "must be a different account");
    } else if (it.to !== undefined) err(`${p}.to`, "only transfers have a destination account");
    const start = date(it, "start", p);
    const end = it.end === undefined ? undefined : date(it, "end", p);
    if (start && end && end < start) err(`${p}.end`, "is before start");
    const item: Item = {
      name,
      category,
      kind: kind ?? "expense",
      amount: amount ?? 0,
      account,
      start,
    };
    if (id !== undefined) item.id = id;
    if (to !== undefined) item.to = to;
    if (end !== undefined) item.end = end;
    if (it.repeat !== undefined) {
      const repeat = parseRepeat(it.repeat, `${p}.repeat`, err);
      if (repeat) item.repeat = repeat;
    }
    items.push(item);
  });

  return errors.length ? { ok: false, errors } : { ok: true, budget: { horizonMonths, accounts, balances, items } };
}

function parseRepeat(r: unknown, p: string, err: (path: string, msg: string) => void): Repeat | null {
  if (!isObj(r)) {
    err(p, 'expected e.g. { "every": 1, "unit": "month" }, or leave it out for a one-off');
    return null;
  }
  if (!UNITS.includes(r.unit as (typeof UNITS)[number])) {
    err(`${p}.unit`, `expected one of ${quoted(UNITS)}`);
    return null;
  }
  if (r.unit === "semimonthly") {
    const days = r.days;
    if (Array.isArray(days) && days.length === 2 && isWhole(days[0], 1, 31) && isWhole(days[1], 1, 31) && days[0] < days[1])
      return { unit: "semimonthly", days: [days[0], days[1]] };
    err(`${p}.days`, "expected two days of the month in order, e.g. [1, 15]");
    return null;
  }
  const every = r.every === undefined ? 1 : r.every;
  if (!isWhole(every, 1, 400)) {
    err(`${p}.every`, "expected a whole number from 1 to 400");
    return null;
  }
  return { unit: r.unit as "day" | "week" | "month" | "year", every };
}
