import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateBudget } from "./data/validate";

it("keeps the README's data-file example valid", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const block = readme.split("```jsonc\n")[1]!.split("```")[0]!;
  const json = block.replace(/\s*\/\/[^\n]*/g, ""); // strip // comments
  const r = validateBudget(JSON.parse(json));
  expect(r.ok ? [] : r.errors).toEqual([]);
});
