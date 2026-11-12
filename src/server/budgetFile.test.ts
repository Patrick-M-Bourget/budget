import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { readBudgetFile, resolveBudgetPath } from "./budgetFile";

const tmp = () => mkdtempSync(join(tmpdir(), "budget-test-"));

describe("resolveBudgetPath", () => {
  it("defaults to ~/Documents/budget/budget.json", () => {
    expect(resolveBudgetPath(undefined)).toBe(join(homedir(), "Documents/budget/budget.json"));
  });
  it("expands ~ and resolves relative paths", () => {
    expect(resolveBudgetPath("~/x.json")).toBe(join(homedir(), "x.json"));
    expect(resolveBudgetPath("/abs/y.json")).toBe("/abs/y.json");
  });
});

describe("readBudgetFile", () => {
  it("reports a missing file", () => {
    const path = join(tmp(), "nope.json");
    expect(readBudgetFile(path)).toEqual({ status: "missing", path });
  });
  it("reports invalid JSON", () => {
    const path = join(tmp(), "bad.json");
    writeFileSync(path, "{ nope");
    const r = readBudgetFile(path);
    expect(r.status).toBe("unreadable");
  });
  it("returns parsed JSON", () => {
    const path = join(tmp(), "ok.json");
    writeFileSync(path, '{"a":1}');
    expect(readBudgetFile(path)).toEqual({ status: "ok", path, json: { a: 1 } });
  });
});
