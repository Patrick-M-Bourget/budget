# budget

A local, single-user forecaster for planning a big home reno. Read `docs/plan.md` before any work.

GitHub user: Patrick-M-Bourget. Run `gh auth status` before any `git push`. The repo is **public**: never commit real financial data. Real data lives outside the repo (`BUDGET_FILE`, default `~/Documents/budget/budget.json`). Test fixtures use made-up numbers only.

On session start, read:
- `.agent/instructions.md`: project context, stack, workflow rules
- `.agent/escalation-levels.md`: L1–L3 autonomy boundaries
- `.agent/commands.md`: `start session`, `end session`
- `.agent/memory/project-context.md`: current phase and decisions
- `.agent/memory/anti-patterns.md`: mistakes not to repeat
- `.agent/memory/journal.md`: session log
- `docs/plan.md`: the agreed v1 plan
- `docs/deferred.md`: scope cut from v1 (don't build it unless a ticket says so)

## Agent skills

### Issue tracker

Issues live in GitHub Issues for Patrick-M-Bourget/budget (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
