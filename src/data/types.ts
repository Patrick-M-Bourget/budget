/** A calendar date as `YYYY-MM-DD`. Never a JS `Date`, so time zones can't shift it. */
export type DateStr = string;
/** Money in integer cents. The JSON file uses dollars; the validator converts. */
export type Cents = number;

export type AccountKind = "cash" | "investment" | "debt";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
};

/**
 * An end-of-day balance read from the bank. The forecast re-anchors to it.
 * Stored as the account's value: a debt is negative (the file says what you owe, as a positive amount).
 */
export type RealBalance = { account: string; date: DateStr; balance: Cents };

export type Repeat =
  | { unit: "day" | "week" | "month" | "year"; every: number }
  /** Twice a month on two days of the month (clamped to month-end). */
  | { unit: "semimonthly"; days: [number, number] };

export type Item = {
  id?: string;
  name: string;
  category: string;
  /** A transfer moves money from `account` to `to` and doesn't change net worth. */
  kind: "income" | "expense" | "transfer";
  /** Always positive; `kind` gives the direction. */
  amount: Cents;
  account: string;
  /** Destination account, for transfers only. */
  to?: string;
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
