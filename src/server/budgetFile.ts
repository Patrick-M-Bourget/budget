import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

/** What the page receives from `/api/budget`. The page validates `json` itself. */
export type BudgetFileResponse =
  | { status: "ok"; path: string; json: unknown }
  | { status: "missing"; path: string }
  | { status: "unreadable"; path: string; error: string };

export function resolveBudgetPath(env: string | undefined): string {
  if (!env) return join(homedir(), "Documents/budget/budget.json");
  return resolve(env.startsWith("~/") ? join(homedir(), env.slice(2)) : env);
}

/** Read-only by design: the app never writes the owner's data file. */
export function readBudgetFile(path: string): BudgetFileResponse {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing", path };
    return { status: "unreadable", path, error: String(e) };
  }
  try {
    return { status: "ok", path, json: JSON.parse(text) };
  } catch (e) {
    return { status: "unreadable", path, error: `Not valid JSON: ${(e as Error).message}` };
  }
}

export const BUDGET_CHANGED_EVENT = "budget:changed";

/** Serves BUDGET_FILE at /api/budget and tells the page when the file changes. */
export function budgetFilePlugin(): Plugin {
  const file = resolveBudgetPath(process.env.BUDGET_FILE);
  return {
    name: "budget-file",
    configureServer(server) {
      server.middlewares.use("/api/budget", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(readBudgetFile(file)));
      });
      server.watcher.add(file);
      const notify = (changed: string) => {
        if (resolve(changed) === file) server.ws.send({ type: "custom", event: BUDGET_CHANGED_EVENT });
      };
      server.watcher.on("add", notify).on("change", notify).on("unlink", notify);
      server.config.logger.info(`  budget file: ${file}`);
    },
  };
}
