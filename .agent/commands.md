# Commands

## start session
Read every file under `.agent/` (including `memory/`), plus `docs/plan.md`, `docs/deferred.md` and `GLOSSARY.md`. Run `gh issue list --state open`. Summarize: current phase, open issues, next step, open questions.

## end session
Append a dated entry to `.agent/memory/journal.md`: what was done, the issues and PRs touched, and what's unfinished. Update `project-context.md` if the phase or decisions changed. Add new lessons to `anti-patterns.md`. Flag unfinished work explicitly.
