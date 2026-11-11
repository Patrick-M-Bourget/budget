# Deferred scope

These were cut from v1 to keep the tool simpler than a spreadsheet. Each is a separate piece of work. Build one only when there's a real need, and give it its own ticket.

## Likely next (when the JSON-only workflow starts to hurt)
- **Editing forms**: add and edit items, accounts, scenarios and real balances in the UI instead of editing `budget.json`.
- **Scenario amount changes**: change an item's amount between two dates. For now, pause the item and add a replacement item in the scenario.
- **Category breakdown**: monthly totals by category on the page. For now, pivot the CSV in Sheets.
- **Next-occurrences preview** when editing an item. Only useful once forms exist.

## Forecast accuracy
- **HELOC daily interest and credit-limit warning**. For now, interest is monthly on the start-of-month balance.
- **Seasonal estimates for variable bills** (e.g. hydro by month).
- **Savings interest and investment returns**. Ruled out on purpose in the grill: they make the forecast look better than reality.
- **Mortgage refinance or blend** as its own feature. For now, model it as a lump sum plus a new payment item.
- **Cash cushion and "earliest affordable start date" search**. Declined in the grill.

## Platform
- **Phone access, PWA, hosting, sync between devices**. Descoped in the grill.
- **Configurable data path in the UI** (for now, the `BUDGET_FILE` environment variable).
- **Additional CSV exports** (schedule, category breakdown). v1 has occurrences and the monthly summary.
- **Auto-start at login** (macOS launchd).

## Ruled out (not deferred)
Transaction logging and bank imports, tax calculation, home value, RRSP contribution room, multiple currencies, CSV import or round-trip, credit card accounts.
