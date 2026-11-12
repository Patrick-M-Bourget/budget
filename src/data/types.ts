/** A calendar date as `YYYY-MM-DD`. Never a JS `Date`, so time zones can't shift it. */
export type DateStr = string;
/** Money in integer cents. The JSON file uses dollars; the validator converts. */
export type Cents = number;

export type Account = {
  id: string;
  name: string;
  kind: "cash";
};

/** An end-of-day balance read from the bank. The forecast re-anchors to it. */
export type RealBalance = { account: string; date: DateStr; balance: Cents };

export type Repeat =
  | { unit: "day" | "week" | "month" | "year"; every: number }
  /** Twice a month on two days of the month (clamped to month-end). */
  | { unit: "semimonthly"; days: [number, number] };

export type Item = {
  id?: string;
  name: string;
  category: string;
  kind: "income" | "expense";
  /** Always positive; `kind` gives the direction. */
  amount: Cents;
  account: string;
  start: DateStr;
  /** Omitted means the item happens once, on `start`. */
  repeat?: Repeat;
  /** Last day the item can occur (inclusive). */
  end?: DateStr;
};

export type Budget = {
  /** Months to forecast from today, 1–36. */
  horizonMonths: number;
  accounts: Account[];
  balances: RealBalance[];
  items: Item[];
};
