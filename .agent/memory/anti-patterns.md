# Anti-patterns

- Building a v1 feature that `docs/deferred.md` lists. Check it first.
- Using JS `Date` for calendar math: time zones shift bills by a day. Use `YYYY-MM-DD` strings plus dayjs.
- Naming an example file `budget*.json`: `.gitignore` blocks that pattern. Fixtures go in `examples/sample*.json`.
- Regenerate `package-lock.json` with the npm version CI uses (`npx -y npm@<ver> install --package-lock-only`). Older npm leaves Linux-only optional deps (`@emnapi/*`) out, and newer npm's `npm ci` then fails with EUSAGE.
- In zsh, `$var:r` (and `:h`, `:t`) after a variable are path modifiers: write `"${c}:refs/heads/x"`, and loop over literal lists, not an unquoted `$list` (zsh doesn't word-split it).
