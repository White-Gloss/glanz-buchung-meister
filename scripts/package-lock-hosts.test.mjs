import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("package-lock tarballs use the public npm registry", async () => {
  const lockfile = await readFile(new URL("../package-lock.json", import.meta.url), "utf8");
  assert.doesNotMatch(lockfile, /package-firewall\.replit\.internal/);
});
