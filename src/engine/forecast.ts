import dayjs from "dayjs";
import type { Account, Budget, Cents, DateStr, Item, MortgageFrequency } from "../data/types";

const fmt = (d: dayjs.Dayjs): DateStr => d.format("YYYY-MM-DD");

/** One dated instance of an item inside the forecast window. */
export type Occurrence = {
  date: DateStr;
  name: string;
  category: string;
  kind: Item["kind"];
  account: string;
  /** Destination, for transfers. */
  to?: string;
  amount: Cents;
  /** Value of `account` right after this occurrence (a debt's value is negative). */
  balanceAfter: Cents;
};
/** End-of-day totals. `debt` is what you owe, as a positive amount. */
export type Totals = { cash: Cents; investment: Cents; debt: Cents; netWorth: Cents };
export type DailyPoint = { date: DateStr; balances: Record<string, Cents>; totals: Totals };
export type MonthRow = {
  /** `YYYY-MM` */
  month: string;
  /** Income and expenses inside the forecast window (first and last months can be partial). Transfers aren't counted. */
  in: Cents;
  out: Cents;
  net: Cents;
  /** End-of-month balance, or the end of the window for the last month. */
  end: Record<string, Cents>;
  endTotals: Totals;
  occurrences: Occurrence[];
};
export type Forecast = {
  from: DateStr;
  to: DateStr;
  daily: DailyPoint[];
  months: MonthRow[];
  /** Lowest end-of-day balance per cash account. */
  lowest: Record<string, { date: DateStr; balance: Cents }>;
  /** Dates to mark on the charts, inside the window. */
  markers: { date: DateStr; label: string }[];
};

/** Same-day order: money in, then money moved between accounts, then money out. */
const KIND_ORDER: Record<Item["kind"], number> = { income: 0, transfer: 1, expense: 2 };

/**
 * Dates an item falls on within [from, to]. Each date is computed from the start
 * (start + k·every units), so a bill on the 31st clamps to short months without drifting.
 */
export function expandItem(item: Item, from: DateStr, to: DateStr): DateStr[] {
  const last = item.end !== undefined && item.end < to ? item.end : to;
  const inRange = (d: DateStr) => d >= from && d <= last && d >= item.start;
  const r = item.repeat;
  if (!r) return inRange(item.start) ? [item.start] : [];

  const dates: DateStr[] = [];
  if (r.unit === "semimonthly") {
    for (let m = dayjs(item.start).startOf("month"); fmt(m) <= last; m = m.add(1, "month")) {
      for (const day of r.days) {
        const d = fmt(m.date(Math.min(day, m.daysInMonth())));
        if (inRange(d) && dates.at(-1) !== d) dates.push(d);
      }
    }
    return dates;
  }

  const start = dayjs(item.start);
  for (let k = 0; ; k++) {
    const d = fmt(start.add(k * r.every, r.unit));
    if (d > last) break;
    if (inRange(d)) dates.push(d);
  }
  return dates;
}

const PERIODS_PER_YEAR: Record<MortgageFrequency, number> = {
  monthly: 12,
  biweekly: 26,
  "accelerated-biweekly": 26,
  weekly: 52,
  "accelerated-weekly": 52,
};
const PAYMENT_REPEAT: Record<MortgageFrequency, Item["repeat"]> = {
  monthly: { unit: "month", every: 1 },
  biweekly: { unit: "week", every: 2 },
  "accelerated-biweekly": { unit: "week", every: 2 },
  weekly: { unit: "week", every: 1 },
  "accelerated-weekly": { unit: "week", every: 1 },
};

/**
 * Interest rate per payment period. Canadian fixed-rate mortgages compound semi-annually,
 * so the effective per-period rate is (1 + r/2)^(2/n) − 1.
 */
export function periodicRate(ratePercent: number, frequency: MortgageFrequency): number {
  return Math.pow(1 + ratePercent / 200, 2 / PERIODS_PER_YEAR[frequency]) - 1;
}

/** Something due on a day: a scheduled item, or a mortgage payment worked out from the balance owed. */
type Due = { order: number; item: Item } | { order: number; mortgage: Account };

/** What gets posted to the accounts and listed in the month. */
type Entry = Pick<Occurrence, "name" | "category" | "kind" | "account" | "to" | "amount">;

/** End-of-day balances per account from `today` over the budget's horizon. */
export function forecast(budget: Budget, today: DateStr): Forecast {
  const to = fmt(dayjs(today).add(budget.horizonMonths, "month").subtract(1, "day"));

  // Real balances by date. A real balance is end-of-day, so it overrides anything due that day.
  const anchors = new Map<DateStr, Record<string, Cents>>();
  let start = today;
  for (const b of budget.balances) {
    anchors.set(b.date, { ...anchors.get(b.date), [b.account]: b.balance });
    if (b.date < start) start = b.date;
  }

  const due = new Map<DateStr, Due[]>();
  const add = (date: DateStr, d: Due) => due.set(date, [...(due.get(date) ?? []), d]);
  for (const item of budget.items) for (const date of expandItem(item, start, to)) add(date, { order: KIND_ORDER[item.kind], item });
  const markers: Forecast["markers"] = [];
  for (const a of budget.accounts) {
    const m = a.mortgage;
    if (!m) continue;
    const schedule: Item = { name: "", category: "", kind: "expense", amount: 0, account: a.id, start: m.firstPayment, repeat: PAYMENT_REPEAT[m.frequency] };
    for (const date of expandItem(schedule, start, to)) add(date, { order: KIND_ORDER.expense, mortgage: a });
    if (m.renewal && m.renewal >= today && m.renewal <= to) markers.push({ date: m.renewal, label: `${a.name} renewal` });
  }
  // Stable sort keeps file order within the same kind.
  for (const list of due.values()) list.sort((a, b) => a.order - b.order);

  // Undefined until the account's first real balance.
  const balances: Record<string, Cents | undefined> = {};
  const snapshot = () => Object.fromEntries(budget.accounts.map((a) => [a.id, balances[a.id] ?? 0]));
  const totals = (end: Record<string, Cents>): Totals => {
    const t = { cash: 0, investment: 0, debt: 0, netWorth: 0 };
    for (const a of budget.accounts) {
      const v = end[a.id] ?? 0;
      if (a.kind === "debt") t.debt -= v;
      else t[a.kind] += v;
      t.netWorth += v;
    }
    return t;
  };
  const cashIds = budget.accounts.filter((a) => a.kind === "cash").map((a) => a.id);
  /** Adds `delta` to an account unless it has no real balance yet or has one today. Returns whether it applied. */
  const move = (id: string | undefined, delta: Cents, anchored: Record<string, Cents>): boolean => {
    if (id === undefined || id in anchored) return false;
    const before = balances[id];
    if (before === undefined) return false;
    balances[id] = before + delta;
    return true;
  };

  const daily: DailyPoint[] = [];
  const months: MonthRow[] = [];
  const lowest: Forecast["lowest"] = {};

  for (let d = dayjs(start); fmt(d) <= to; d = d.add(1, "day")) {
    const date = fmt(d);
    const inWindow = date >= today;
    const anchored = anchors.get(date) ?? {};

    let row = months.at(-1);
    if (inWindow && row?.month !== date.slice(0, 7))
      months.push((row = { month: date.slice(0, 7), in: 0, out: 0, net: 0, end: {}, endTotals: totals({}), occurrences: [] }));

    /** Applies an entry to its account(s) and lists it in the month if inside the window. */
    const post = (e: Entry) => {
      const fromApplied = move(e.account, e.kind === "income" ? e.amount : -e.amount, anchored);
      const toApplied = e.kind === "transfer" && move(e.to, e.amount, anchored);
      if ((!fromApplied && !toApplied) || !inWindow || !row) return;
      const occ: Occurrence = { date, ...e, balanceAfter: balances[e.account] ?? 0 };
      if (e.to === undefined) delete occ.to;
      row.occurrences.push(occ);
      if (e.kind === "income") row.in += e.amount;
      if (e.kind === "expense") row.out += e.amount;
      row.net = row.in - row.out;
    };

    for (const d of due.get(date) ?? []) {
      if ("item" in d) {
        const { name, category, kind, account, to, amount } = d.item;
        post({ name, category, kind, account, to, amount });
        continue;
      }
      // Mortgage payment: interest on what's owed is spending; the rest pays down the principal.
      const a = d.mortgage;
      const m = a.mortgage!;
      const owed = -(balances[a.id] ?? 0);
      if (balances[a.id] === undefined || owed <= 0) continue;
      const interest = Math.round(owed * periodicRate(m.ratePercent, m.frequency));
      const principal = Math.min(m.payment, owed + interest) - interest;
      if (interest > 0) post({ name: `${a.name} interest`, category: "Housing", kind: "expense", account: m.paidFrom, amount: interest });
      if (principal > 0)
        post({ name: `${a.name} principal`, category: "Housing", kind: "transfer", account: m.paidFrom, to: a.id, amount: principal });
    }
    Object.assign(balances, anchored);

    if (!inWindow || !row) continue;
    const end = snapshot();
    const t = totals(end);
    daily.push({ date, balances: end, totals: t });
    row.end = end;
    row.endTotals = t;
    for (const id of cashIds) {
      const balance = end[id] ?? 0;
      const low = lowest[id];
      if (!low || balance < low.balance) lowest[id] = { date, balance };
    }
  }

  return { from: today, to, daily, months, lowest, markers };
}
