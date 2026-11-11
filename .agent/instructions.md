# Instructions

## Context
`budget` answers one question: can the owner afford a big home reno, and how do they pay for it (savings and/or a HELOC)? It forecasts accounts 12 months ahead by default (up to 36), comparing the current plan against reno scenarios, and exports CSV for Google Sheets. It's single-user, runs only on the owner's Mac, and uses CAD.

The bar is "simpler than a Google Sheet would be". If a feature isn't needed for reno planning, it belongs in `docs/deferred.md`, not in the code.

The source of truth is `docs/plan.md` (agreed in a grill session on 2026-11-11). Domain terms are in `GLOSSARY.md`.

## Stack
- Vite + React + TypeScript, Mantine core + charts, dayjs, Vitest. No other dependencies without asking.
- Data is one JSON file outside the repo, served and watched by a Vite plugin. `npm start` serves on 127.0.0.1:4747 and errors rather than switching ports.
- The forecast engine (`src/engine/`) is pure TypeScript with no React or IO. Build it test-first (`/tdd`).
- Money is integer cents. Dates are `YYYY-MM-DD` strings; never use `Date` for calendar math.

## Privacy (public repo)
- Never commit real numbers. `.gitignore` blocks `*.csv` and `budget*.json`. Fixtures live in `examples/` and use made-up numbers.
- When loading the owner's real data, write only to `BUDGET_FILE`.

## Workflow
- Work from GitHub issues (see `docs/agents/issue-tracker.md`). One issue per branch and PR, with small focused commits.
- Run `npm run typecheck && npm test` before every commit.
- Check UI changes yourself in headless Chrome before handing them over.
- Matt Pocock skills are configured: `/to-tickets`, `/triage`, `/tdd`, `/grill-with-docs`, `/domain-modeling`, `/code-review`, `/diagnosing-bugs`, `/improve-codebase-architecture`.

## Tone
Direct, no padding. Say "I'm not sure" when unsure. Push back on scope creep.
