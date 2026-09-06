import assert from "node:assert/strict";
import { test } from "node:test";
import { repairSsrNamespace } from "./ssr-namespace-repair.mjs";

test("repairs and evaluates the namespace for different bundler export aliases", async () => {
  for (const alias of ["s", "u", "a", "z", "a$1"]) {
    const input = `var __exportAll = (values) => Object.fromEntries(Object.entries(values).map(([k, getter]) => [k, getter()]));\nconst server_default = 42; const server_exports = {value:1};\nexport {ssr_exports as ${alias}};`;
    const fixed = repairSsrNamespace(input);
    const module = await import(`data:text/javascript,${encodeURIComponent(fixed)}`);
    assert.deepEqual(module[alias], { default: 42, t: { value: 1 } });
    assert.equal(repairSsrNamespace(fixed), fixed);
  }
});
test("leaves unaffected bundles alone and rejects unknown broken bundle shapes", () => {
  assert.equal(repairSsrNamespace("export const value = 1;"), "export const value = 1;");
  assert.throws(() => repairSsrNamespace("export {ssr_exports as u};"), /nicht sicher/);
});
