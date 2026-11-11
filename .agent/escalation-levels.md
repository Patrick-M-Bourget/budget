# Escalation levels

Anything not listed is safe and reversible: proceed.

## L1: Inform (do it, then explain)
- Refactoring within one file
- Adding error handling
- Minor/patch dependency updates
- New utility files

## L2: Propose (wait for approval)
- Changing the `budget.json` data format, or the engine's public interface
- Deleting files or removing functionality
- Changes touching more than 3 files
- Anything that reads or writes the owner's real data file
- New dependencies, or anything from `docs/deferred.md`

## L3: Stop (flag and wait)
- Irreversible data operations (overwriting the owner's data file without a copy)
- CI/CD pipeline changes
- Security-sensitive changes (secrets, permissions, network exposure beyond 127.0.0.1)
- Architecture decisions affecting the whole system
- Uncertain about the right approach
