import { describe, expect, it } from "vitest";
import type { Budget } from "./data/types";
import { comparePlans } from "./engine/forecast";
import { BOM, dollars, monthlyCsv, occurrencesCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes only fields that need it and doubles inner quotes (RFC 4180)", () => {
    expect(toCsv([["a", "b,c", 'say "hi"', "two\nlines", " pad", 12.5]])).toBe(
      'a,"b,c","say ""hi""","two\nlines"," pad",12.5\r\n',
    );
  });
  it("ends every row with CRLF", () => {
    expect(toCsv([["x"], ["y"]])).toBe("x\r\ny\r\n");
  });
});

describe("dollars", () => {
  it("writes plain decimals with no symbols or separators", () => {
    expect(dollars(123456_78)).toBe("123456.78");
    expect(dollars(-5)).toBe("-0.05");
    expect(dollars(0)).toBe("0.00");
  });
});

const budget: Budget = {
  horizonMonths: 2,
  accounts: [
    { id: "chq", name: "Chequing", kind: "cash" },
    { id: "heloc", name: "HELOC, home", kind: "debt" },
  ],
  balances: [
    { account: "chq", date: "2026-01-01", balance: 1000_00 },
    { account: "heloc", date: "2026-01-01", balance: -500_00 },
  ],
  items: [{ name: "Rent", category: "Housing", kind: "expense", amount: 300_00, account: "chq", start: "2026-01-20" }],
  scenarios: [
    {
      id: "reno",
      name: "Reno",
      contingencyPercent: 0,
      items: [{ name: "Draw", category: "Reno", kind: "transfer", amount: 200_00, account: "heloc", to: "chq", start: "2026-02-05" }],
      pauses: [],
    },
  ],
};
const plans = comparePlans(budget, "2026-01-10", ["reno"]);

describe("occurrencesCsv", () => {
  it("lists every occurrence of every plan, with debts shown as owed", () => {
    const csv = occurrencesCsv(plans, budget.accounts);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(BOM.length).split("\r\n")).toEqual([
      "scenario,date,item,category,kind,account,to_account,amount,balance_after",
      "Current plan,2026-01-20,Rent,Housing,expense,Chequing,,300.00,700.00",
      "Reno,2026-01-20,Rent,Housing,expense,Chequing,,300.00,700.00",
      'Reno,2026-02-05,Draw,Reno,transfer,"HELOC, home",Chequing,200.00,700.00',
      "",
    ]);
  });
});

describe("monthlyCsv", () => {
  it("has one row per plan and month, with an end column per account and net worth", () => {
    const rows = monthlyCsv(plans, budget.accounts).slice(BOM.length).split("\r\n");
    expect(rows[0]).toBe('scenario,month,in,out,net,Chequing (end),"HELOC, home (owed)",net_worth');
    expect(rows[1]).toBe("Current plan,2026-01,0.00,300.00,-300.00,700.00,500.00,200.00");
    expect(rows[5]).toBe("Reno,2026-02,0.00,0.00,0.00,900.00,700.00,200.00");
    expect(rows).toHaveLength(2 * 3 + 2); // header + 3 months × 2 plans + trailing newline
  });
});
