# Plan: reno budget forecaster (v1)

## Context
This is a single-user, local tool to plan a big reno. It compares your current plan against reno scenarios over 12 to 36 months, showing net worth, cash, debt and the lowest checking balance, and exports CSV for Google Sheets. The bar: it has to beat a spreadsheet at expanding repeating payments and comparing scenarios, and do nothing more.

## Decisions (from the grill)
- Single user, local only, CAD only. Net pay. Variable bills use fixed estimates. No interest on savings, no investment returns, no tax calculation, no home value.
- Accounts: `cash` (checking, savings), `investment` (RRSP), `debt` (mortgage, HELOC).
- Real balances re-anchor the forecast. Items on or before a real balance's date are treated as already paid.
- Mortgage: you enter the lender's real payment. The app splits interest and principal (Canadian semi-annual compounding) and marks the renewal date.
- HELOC: rate. Interest is charged monthly on the balance at the start of the month and paid from checking. Draws and repayments are transfers.
- Scenarios: your current plan plus one scenario, never stacked. A scenario has its own items, a contingency % (default 15) and pauses of current-plan items.
- CSV export only, with a `scenario` column.
- Public repo. Your data lives outside the repo. CI runs typecheck and tests.

## What the "don't overengineer" review cut
| Cut | Replaced by |
|---|---|
| Forms for adding and editing items, accounts and scenarios | **v1 is JSON in, charts out.** You (or Claude) edit `budget.json`, and the page reloads live. |
| Custom Node server, atomic writes | A small Vite plugin serves the JSON file and watches it for changes |
| React Router, 6 screens | One page: scenario toggles, a chart, the monthly table, export buttons |
| Category breakdown, next 30 days, previewing an item's next dates, an editable category list | Category is a free-text field. Pivot by category in Sheets. |
| Scenario "amount changes" | Pause the item, then add the replacement item inside the scenario |
| Daily HELOC interest, credit-limit warning | Monthly interest on the start-of-month balance |
| 4 CSV types | 2: individual items and monthly summary |
| Configurable data path setting | Environment variable `BUDGET_FILE`, default `~/Documents/budget/budget.json` |

## Stack
Vite + React + TypeScript, Mantine core + charts (tables and line chart built in), dayjs, Vitest. A hand-written validator gives clear errors when the hand-edited JSON is wrong. No other dependencies.

## Shape
- `src/engine/`: pure TypeScript. Expands schedules into dated payments, runs balances, mortgage, HELOC, applies scenarios, builds monthly rollups. Built test-first.
- `src/data/`: the JSON schema types and the validator.
- `src/csv.ts`: CSV writer.
- `src/App.tsx`: the single page.
- `vite.config.ts`: the plugin that serves and watches `BUDGET_FILE`. `npm start` serves at 127.0.0.1:4747 and errors rather than switching ports.
- `examples/sample.json`: made-up numbers, also used as a test case.

## Verification
- Vitest engine tests: frequencies, month-end clamping, twice-monthly, transfers, real balances, mortgage split, HELOC interest, scenario pauses and contingency.
- `npm start` with the example file, checked in headless Chrome. Exported CSVs imported into Google Sheets.
- Your real data loaded and compared against figures you work out by hand.

## Agent setup (already done, nothing to set up by hand)
- `CLAUDE.md` is the entry point. It lists every file to read on session start.
- `.agent/` (from `/project-setup`): `instructions.md`, `escalation-levels.md`, `commands.md` (`start session` / `end session`), and `memory/` (project context, anti-patterns, journal).
- `docs/agents/` (Matt Pocock skills config): `issue-tracker.md` (GitHub Issues via `gh`), `triage-labels.md` (default labels, created in the repo), `domain.md` (single context).
- `GLOSSARY.md` holds the domain terms agreed in the grill. `docs/adr/` is created as decisions come up (`/domain-modeling`).
- `docs/deferred.md` holds the scope cut from v1.
