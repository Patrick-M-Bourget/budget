import dayjs from "dayjs";
import type { Budget, Cents, DateStr, Item } from "../data/types";

const fmt = (d: dayjs.Dayjs): DateStr => d.format("YYYY-MM-DD");

/** One dated instance of an item inside the forecast window. */
export type Occurrence = {
  date: DateStr;
  name: string;
  category: string;
  kind: Item["kind"];
  account: string;
  amount: Cents;
  /** End balance of `account` right after this occurrence. */
  balanceAfter: Cents;
};
export type DailyPoint = { date: DateStr; balances: Record<string, Cents> };
export type MonthRow = {
  /** `YYYY-MM` */
  month: string;
  /** Income and expenses inside the forecast window (first and last months can be partial). */
  in: Cents;
  out: Cents;
  net: Cents;
  /** End-of-month balance, or the end of the window for the last month. */
  end: Record<string, Cents>;
  occurrences: Occurrence[];
};
export type Forecast = {
  from: DateStr;
  to: DateStr;
  daily: DailyPoint[];
  months: MonthRow[];
  lowest: Record<string, { date: DateStr; balance: Cents }>;
};

/** Same-day order: money in before money out. */
const KIND_ORDER: Record<Item["kind"], number> = { income: 0, expense: 1 };

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

  const due = new Map<DateStr, Item[]>();
  for (const item of budget.items)
    for (const date of expandItem(item, start, to)) due.set(date, [...(due.get(date) ?? []), item]);
  for (const list of due.values()) list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

  // Undefined until the account's first real balance.
  const balances: Record<string, Cents | undefined> = {};
  const snapshot = () => Object.fromEntries(budget.accounts.map((a) => [a.id, balances[a.id] ?? 0]));

  const daily: DailyPoint[] = [];
  const months: MonthRow[] = [];
  const lowest: Forecast["lowest"] = {};

  for (let d = dayjs(start); fmt(d) <= to; d = d.add(1, "day")) {
    const date = fmt(d);
    const inWindow = date >= today;
    const anchored = anchors.get(date) ?? {};

    let row = months.at(-1);
    if (inWindow && row?.month !== date.slice(0, 7))
      months.push((row = { month: date.slice(0, 7), in: 0, out: 0, net: 0, end: {}, occurrences: [] }));

    for (const item of due.get(date) ?? []) {
      const before = balances[item.account];
      if (before === undefined || item.account in anchored) continue;
      const after = before + (item.kind === "income" ? item.amount : -item.amount);
      balances[item.account] = after;
      if (!inWindow || !row) continue;
      row.occurrences.push({
        date,
        name: item.name,
        category: item.category,
        kind: item.kind,
        account: item.account,
        amount: item.amount,
        balanceAfter: after,
      });
      if (item.kind === "income") row.in += item.amount;
      else row.out += item.amount;
      row.net = row.in - row.out;
    }
    Object.assign(balances, anchored);

    if (!inWindow || !row) continue;
    const end = snapshot();
    daily.push({ date, balances: end });
    row.end = end;
    for (const [id, balance] of Object.entries(end)) {
      const low = lowest[id];
      if (!low || balance < low.balance) lowest[id] = { date, balance };
    }
  }

  return { from: today, to, daily, months, lowest };
}
