import { useEffect, useState } from "react";
import type { BudgetFileResponse } from "./server/budgetFile";

const CHANGED = "budget:changed"; // keep in sync with BUDGET_CHANGED_EVENT (server-only module)

/** Fetches the budget file from the dev server and refetches whenever it changes on disk. */
export function useBudgetFile(): BudgetFileResponse | { status: "loading" } | { status: "offline"; error: string } {
  const [state, setState] = useState<ReturnType<typeof useBudgetFile>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/budget")
        .then((r) => r.json() as Promise<BudgetFileResponse>)
        .then((r) => !cancelled && setState(r))
        .catch((e) => !cancelled && setState({ status: "offline", error: String(e) }));
    load();
    import.meta.hot?.on(CHANGED, load);
    return () => {
      cancelled = true;
      import.meta.hot?.off(CHANGED, load);
    };
  }, []);

  return state;
}
