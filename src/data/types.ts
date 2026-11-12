/** A calendar date as `YYYY-MM-DD`. Never a JS `Date`, so time zones can't shift it. */
export type DateStr = string;
/** Money in integer cents. The JSON file uses dollars; the validator converts. */
export type Cents = number;

export type AccountKind = "cash" | "investment" | "debt";

export type MortgageFrequency = "monthly" | "biweekly" | "accelerated-biweekly" | "weekly" | "accelerated-weekly";

/** Payment terms for a debt account that is a mortgage. */
export type Mortgage = {
  /** Annual rate in percent, compounded semi-annually (Canadian fixed-rate convention). */
  ratePercent: number;
  /** The lender's actual payment amount. */
  payment: Cents;
  frequency: MortgageFrequency;
  firstPayment: DateStr;
  /** Cash account the payment comes out of. */
  paidFrom: string;
  /** End of the current term; drawn on the chart. The rate is assumed to stay the same after it. */
  renewal?: DateStr;
};

/** Terms for a debt account that is a home-equity line of credit. */
export type Heloc = {
  /** Annual rate in percent. Interest is charged monthly on the balance owed at the start of the month. */
  ratePercent: number;
  /** Cash account the monthly interest comes out of. */
  interestFrom: string;
};

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  /** Only on debt accounts, and not together with `heloc`. */
  mortgage?: Mortgage;
  heloc?: Heloc;
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

/** Hides a current-plan item's occurrences between two dates (inclusive) while a scenario is on. */
export type Pause = { item: string; from: DateStr; to: DateStr };

/** A "what if" forecast as current plan + this scenario alone. Scenarios never stack. */
export type Scenario = {
  id: string;
  name: string;
  /** Scales this scenario's expense items up, e.g. 15 means +15%. */
  contingencyPercent: number;
  items: Item[];
  pauses: Pause[];
};

export type Budget = {
  /** Months to forecast from today, 1–36. */
  horizonMonths: number;
  accounts: Account[];
  balances: RealBalance[];
  items: Item[];
  scenarios: Scenario[];
};
