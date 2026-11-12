/** A calendar date as `YYYY-MM-DD`. Never a JS `Date`, so time zones can't shift it. */
export type DateStr = string;
/** Money in integer cents. The JSON file uses dollars; the validator converts. */
export type Cents = number;

export type Account = {
  id: string;
  name: string;
  kind: "cash";
  /** End-of-day balance on `openingDate`. Occurrences on or before that date are already in it. */
  openingDate: DateStr;
  openingBalance: Cents;
};

export type Repeat = { every: number; unit: "month" };

export type Item = {
  name: string;
  category: string;
  kind: "income" | "expense";
  /** Always positive; `kind` gives the direction. */
  amount: Cents;
  account: string;
  start: DateStr;
  repeat: Repeat;
};

export type Budget = {
  /** Months to forecast from today, 1–36. */
  horizonMonths: number;
  accounts: Account[];
  items: Item[];
};
