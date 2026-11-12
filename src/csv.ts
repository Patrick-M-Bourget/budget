import type { Account, Cents } from "./data/types";
import type { Plan } from "./engine/forecast";

/** UTF-8 byte-order mark: Google Sheets ignores it, and it stops Excel from mangling accents. */
export const BOM = "﻿";

type Cell = string | number;

/** RFC 4180: quote a field only if it has a comma, quote, line break or edge space; rows end with CRLF. */
export function toCsv(rows: Cell[][]): string {
  const field = (c: Cell) => {
    const s = String(c);
    return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(field).join(",") + "\r\n").join("");
}

/** Plain decimal dollars ("1234.50"), which Sheets parses as a number in any locale that uses a dot. */
export const dollars = (c: Cents): string => (c < 0 ? "-" : "") + (Math.abs(c) / 100).toFixed(2);

/** Debts are negative inside the engine; exports show what's owed, like the page does. */
const shown = (a: Account | undefined, v: Cents) => (a?.kind === "debt" ? -v : v);

export function occurrencesCsv(plans: Plan[], accounts: Account[]): string {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows: Cell[][] = [["scenario", "date", "item", "category", "kind", "account", "to_account", "amount", "balance_after"]];
  for (const p of plans)
    for (const m of p.forecast.months)
      for (const o of m.occurrences) {
        const a = byId.get(o.account);
        rows.push([
          p.name,
          o.date,
          o.name,
          o.category,
          o.kind,
          a?.name ?? o.account,
          o.to === undefined ? "" : (byId.get(o.to)?.name ?? o.to),
          dollars(o.amount),
          dollars(shown(a, o.balanceAfter)),
        ]);
      }
  return BOM + toCsv(rows);
}

export function monthlyCsv(plans: Plan[], accounts: Account[]): string {
  const rows: Cell[][] = [
    ["scenario", "month", "in", "out", "net", ...accounts.map((a) => `${a.name} (${a.kind === "debt" ? "owed" : "end"})`), "net_worth"],
  ];
  for (const p of plans)
    for (const m of p.forecast.months)
      rows.push([
        p.name,
        m.month,
        dollars(m.in),
        dollars(m.out),
        dollars(m.net),
        ...accounts.map((a) => dollars(shown(a, m.end[a.id] ?? 0))),
        dollars(m.endTotals.netWorth),
      ]);
  return BOM + toCsv(rows);
}

/** Hands the CSV to the browser as a download. */
export function download(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
