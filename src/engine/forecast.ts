import dayjs from "dayjs";
import type { Budget, Cents, DateStr, Item } from "../data/types";

const fmt = (d: dayjs.Dayjs): DateStr => d.format("YYYY-MM-DD");

export type DailyPoint = { date: DateStr; balances: Record<string, Cents> };
export type MonthRow = {
  /** `YYYY-MM` */
  month: string;
  /** Income and expenses that fall inside the forecast window (first and last months can be partial). */
  in: Cents;
  out: Cents;
  net: Cents;
  /** End-of-month balance, or the end of the window for the last month. */
  end: Record<string, Cents>;
};
export type Forecast = {
  from: DateStr;
  to: DateStr;
  daily: DailyPoint[];
  months: MonthRow[];
  lowest: Record<string, { date: DateStr; balance: Cents }>;
};

/**
 * Dates an item falls on within [from, to]. Each date is computed from the start
 * (start + k·every months), so a bill on the 31st clamps to short months without drifting.
 */
export function expandItem(item: Item, from: DateStr, to: DateStr): DateStr[] {
  const start = dayjs(item.start);
  const dates: DateStr[] = [];
  for (let k = 0; ; k++) {
    const d = fmt(start.add(k * item.repeat.every, "month"));
    if (d > to) break;
    if (d >= from) dates.push(d);
  }
  return dates;
}

/** End-of-day balances per account from `today` over the budget's horizon. */
export function forecast(budget: Budget, today: DateStr): Forecast {
  const to = fmt(dayjs(today).add(budget.horizonMonths, "month").subtract(1, "day"));
  const opening = new Map(budget.accounts.map((a) => [a.id, a]));
  const earliest = budget.accounts.reduce((min, a) => (a.openingDate < min ? a.openingDate : min), today);

  // Signed change per (date, account), plus in/out per date for the monthly rollup.
  const deltas = new Map<DateStr, { by: Record<string, Cents>; in: Cents; out: Cents }>();
  for (const item of budget.items) {
    const acct = opening.get(item.account);
    if (!acct) continue;
    for (const date of expandItem(item, earliest, to)) {
      if (date <= acct.openingDate) continue; // already in the opening balance
      const day = deltas.get(date) ?? { by: {}, in: 0, out: 0 };
      const signed = item.kind === "income" ? item.amount : -item.amount;
      day.by[item.account] = (day.by[item.account] ?? 0) + signed;
      if (date >= today) item.kind === "income" ? (day.in += item.amount) : (day.out += item.amount);
      deltas.set(date, day);
    }
  }

  const balances: Record<string, Cents> = Object.fromEntries(budget.accounts.map((a) => [a.id, a.openingBalance]));
  const apply = (date: DateStr) => {
    for (const [id, v] of Object.entries(deltas.get(date)?.by ?? {})) balances[id] = (balances[id] ?? 0) + v;
  };

  // Catch up from the earliest opening date to the day before today.
  for (let d = dayjs(earliest).add(1, "day"); fmt(d) < today; d = d.add(1, "day")) apply(fmt(d));

  const daily: DailyPoint[] = [];
  const months: MonthRow[] = [];
  const lowest: Forecast["lowest"] = {};
  for (let d = dayjs(today); fmt(d) <= to; d = d.add(1, "day")) {
    const date = fmt(d);
    apply(date);
    daily.push({ date, balances: { ...balances } });

    for (const [id, balance] of Object.entries(balances)) {
      const low = lowest[id];
      if (!low || balance < low.balance) lowest[id] = { date, balance };
    }

    const month = date.slice(0, 7);
    let row = months.at(-1);
    if (row?.month !== month) months.push((row = { month, in: 0, out: 0, net: 0, end: {} }));
    const day = deltas.get(date);
    if (day) {
      row.in += day.in;
      row.out += day.out;
      row.net = row.in - row.out;
    }
    row.end = { ...balances };
  }

  return { from: today, to, daily, months, lowest };
}
