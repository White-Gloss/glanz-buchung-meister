import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("response timeout and UI failure both stay caught even when the other operation is pending", () => {
  for (const first of ["response", "action"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import { observeBrowserAction } from ${JSON.stringify(new URL("./qa/browser-action.mjs", import.meta.url).href)};
      const first = ${JSON.stringify(first)};
      const fail = (name, ms) => new Promise((_, reject) => setTimeout(() => reject(new Error(name)), ms));
      try {
        await observeBrowserAction({ waitForResponse: () => fail('response', first === 'response' ? 0 : 30) }, () => true, () => fail('action', first === 'action' ? 0 : 30));
      } catch (error) { console.log('caught:' + error.message); }
      await new Promise((resolve) => setTimeout(resolve, 50));
    `], { encoding: "utf8", timeout: 3000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), `caught:${first}`);
    assert.equal(result.stderr, "");
  }
});
