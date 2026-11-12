# Journal

## 2026-11-11
- Grilled the idea from "personal budget app" down to a "reno planning forecaster". Big cuts: phone/PWA, sync, hosting, forms (v1 is JSON in, charts out). See `docs/plan.md` and `docs/deferred.md`.
- Scaffolded the repo: `CLAUDE.md`, `.agent/`, `docs/agents/` (GitHub tracker, default triage labels, single-context domain docs), and `GLOSSARY.md`.
- Filed layer tickets #1–#9, then re-cut them into vertical slices #11–#18 with /to-tickets (#1–#9 closed as replaced). Deferred-scope review is #10. Unfinished: all code. Start at #11.

## 2026-11-11 (later): v1 built
- Owner said "one shot it": #11–#17 built and merged as PRs #19–#25, each with CI green and a headless-Chrome screenshot (hosted on the `pr-assets` branch).
- Format decisions: amounts in the file are dollars (converted to cents); the opening balance became the first real balance; debts are entered as owed and stored negative, so net worth is a plain sum.
- Screenshot tooling: puppeteer-core in the session scratchpad drives the local Chrome. It's not a project dependency.
- Not verified: importing the CSVs into Google Sheets itself (needs the owner's account). Python's csv module parsed both downloads cleanly.
- Next: #18 (owner pastes real numbers; Claude writes only to BUDGET_FILE) and #10 (review deferred scope).
