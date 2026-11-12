# budget

A local forecaster for planning a home reno. It compares your current plan against reno scenarios: net worth, cash, debt, and the lowest balance of each cash account. Exports go to CSV for Google Sheets.

## Run it

```sh
npm install
mkdir -p ~/Documents/budget && cp examples/sample.json ~/Documents/budget/budget.json   # first time only
npm start            # http://127.0.0.1:4747, only reachable from this Mac
```

To use another data file: `BUDGET_FILE=~/somewhere/else.json npm start`. The page reloads by itself when you save the file, and the app never writes to it. Keep real data out of this repo, which is public.

## The data file

Amounts are dollars (`3100.00`), and dates are `YYYY-MM-DD`. A mistake shows on the page with its exact location, e.g. `items[3].start: expected a real date as YYYY-MM-DD`. `examples/sample.json` uses every feature.

```jsonc
{
  "horizonMonths": 12,                       // 1–36, default 12
  "accounts": [
    { "id": "chequing", "name": "Chequing", "kind": "cash" },          // cash | investment | debt
    { "id": "savings", "name": "Savings", "kind": "cash" },
    { "id": "mortgage", "name": "Mortgage", "kind": "debt",
      "mortgage": { "ratePercent": 4.79, "payment": 2400.00, "frequency": "monthly",   // or biweekly, accelerated-biweekly, weekly, accelerated-weekly
                    "firstPayment": "2026-12-01", "paidFrom": "chequing", "renewal": "2028-06-01" } },
    { "id": "heloc", "name": "HELOC", "kind": "debt",
      "heloc": { "ratePercent": 6.2, "interestFrom": "chequing" } }
  ],
  "balances": [                              // real balances, end of day; every account needs one
    { "account": "chequing", "date": "2026-11-10", "balance": 2650.00 },
    { "account": "savings", "date": "2026-11-01", "balance": 18500.00 },
    { "account": "heloc", "date": "2026-11-01", "balance": 0.00 },
    { "account": "mortgage", "date": "2026-11-01", "balance": 412000.00 }   // debts: the amount owed
  ],
  "items": [
    { "name": "Salary", "category": "Income", "kind": "income", "amount": 3100.00,
      "account": "chequing", "start": "2026-11-15", "repeat": { "unit": "semimonthly", "days": [15, 31] } },
    { "name": "Hydro", "kind": "expense", "amount": 180.00, "account": "chequing",
      "start": "2026-11-20", "repeat": { "unit": "month", "every": 2 }, "end": "2027-12-31" },
    { "id": "tfsa", "name": "TFSA", "kind": "transfer", "amount": 500.00, "account": "chequing", "to": "savings",
      "start": "2026-12-01", "repeat": { "unit": "month" } },
    { "name": "Furnace service", "kind": "expense", "amount": 240.00, "account": "chequing", "start": "2027-01-20" }  // no repeat = one-off
  ],
  "scenarios": [
    { "id": "reno-2027", "name": "Reno, summer 2027", "contingencyPercent": 15,   // scales the scenario's expenses
      "items": [ { "name": "Contractor deposit", "category": "Reno", "kind": "expense", "amount": 12000.00,
                   "account": "chequing", "start": "2027-05-03" } ],
      "pauses": [ { "item": "tfsa", "from": "2027-05-01", "to": "2027-10-31" } ] }  // hides a current-plan item by id
  ]
}
```

- **Repeat units:** `day`, `week`, `month`, `year` (with `every`, default 1) or `semimonthly` (with `days`). Days past month-end move to the last day of the month.
- **Real balances** restart the forecast. Anything due on or before a real balance's date is treated as already in it.
- **Mortgage:** each payment's interest counts as spending, and the rest pays down what's owed (Canadian semi-annual compounding).
- **HELOC:** interest on what's owed is charged on the 1st of each month. Borrow with a transfer from the HELOC, pay a contractor with an expense on the HELOC, and repay with a transfer to it.
- **Net worth** doesn't count your home's value.

## Develop

`npm run typecheck && npm test`. The plan is in `docs/plan.md`, the cut scope in `docs/deferred.md`, and terms in `GLOSSARY.md`.
