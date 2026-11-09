import assert from "node:assert/strict";
import { test } from "node:test";
import { cmsEnabled, createOptionalCmsReader } from "./cms.availability.ts";

test("Studio stays disabled without the explicit flag or the existing strict CI proof", () => {
  assert.equal(cmsEnabled({ isolatedCi: false }), false);
  assert.equal(cmsEnabled({ enabled: "false", isolatedCi: false }), false);
  assert.equal(cmsEnabled({ enabled: "1", isolatedCi: false }), false);
  assert.equal(cmsEnabled({ enabled: "true", isolatedCi: false }), true);
  assert.equal(cmsEnabled({ isolatedCi: true }), true);
  assert.equal(cmsEnabled({ enabled: "false", isolatedCi: true }), false);
});

test("A disabled optional reader never invokes the database callback", async () => {
  let calls = 0;
  const read = createOptionalCmsReader({ enabled: () => cmsEnabled({ isolatedCi: false }) });
  const result = await read("home", async () => { calls++; return "unreleased"; });
  assert.equal(result, null);
  assert.equal(calls, 0);
});

test("Optional public CMS failures return fallback and open a short circuit", async () => {
  let calls = 0;
  const failures: string[] = [];
  const read = createOptionalCmsReader({ budgetMs: 15, cooldownMs: 100, onFailure: (reason) => failures.push(reason) });
  const result = await read("home", async () => { calls++; throw new Error("private database details"); }).catch(() => "rejected");
  assert.equal(result, null);
  assert.equal(await read("home", async () => { calls++; return "unreachable"; }), null);
  assert.equal(calls, 1);
  assert.deepEqual(failures, ["unavailable"]);
});

test("Hanging public reads have a budget, deduplicate in-flight work and never cache content", async () => {
  let calls = 0;
  let complete!: (value: string) => void;
  const read = createOptionalCmsReader({ budgetMs: 10, cooldownMs: 10 });
  const work = () => { calls++; return new Promise<string>((resolve) => { complete = resolve; }); };
  const started = Date.now();
  const results = await Promise.race([
    Promise.all([read("home", work), read("home", work)]),
    new Promise<string>((resolve) => setTimeout(() => resolve("unbounded"), 100)),
  ]);
  if (results === "unbounded") complete("Finish failed test");
  assert.deepEqual(results, [null, null]);
  assert.equal(calls, 1);
  assert.ok(Date.now() - started < 500);
  complete("Old content must not be cached");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(await read("home", async () => "Fresh publication"), "Fresh publication");
  assert.equal(await read("home", async () => "Next publication"), "Next publication");
});

