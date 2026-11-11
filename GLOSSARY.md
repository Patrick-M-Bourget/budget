# Glossary

| Term | Meaning | Avoid |
|---|---|---|
| **Account** | Somewhere money sits or is owed. Its kind is `cash` (checking, savings), `investment` (RRSP) or `debt` (mortgage, HELOC). | wallet |
| **Item** | One scheduled income, expense or transfer: amount (cents, > 0), category (free text), schedule, start, optional end. Allocations such as groceries are just expense items. | rule, bill, transaction |
| **Schedule** | How an item repeats: `once`, every N `day/week/month/year`, or `semimonthly(d1, d2)`. Days past month-end are clamped to the last day. | cadence, recurrence |
| **Occurrence** | One dated instance of an item, produced by the engine. | entry |
| **Transfer** | An item that moves money between two accounts (savings contribution, HELOC draw, prepayment). It doesn't change net worth. | |
| **Real balance** | An end-of-day balance the owner reads from the bank. The forecast re-anchors to it, and occurrences on or before its date count as already applied. | snapshot, reconcile |
| **Current plan** | Every item not in a scenario. | baseline |
| **Scenario** | A named "what if" (e.g. "Reno, summer 2027"): its own items, a **contingency** % on its expenses (default 15), and **pauses** of current-plan items between two dates. It is always forecast as current plan + that scenario alone, never stacked. | |
| **Horizon** | How far the forecast runs: 12 months by default, up to 36. | |
| **Renewal marker** | The date the mortgage term ends, drawn on the chart. The forecast keeps the current rate past it. | |
