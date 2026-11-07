import assert from "node:assert/strict";
import test from "node:test";
import { revealTargetWithWheel } from "./qa/scroll-target.mjs";

function geometry(scrollY, target = 7284.5) {
  return { top: target - scrollY, bottom: target + 122 - scrollY, width: 358, height: 122, headerBottom: 88, viewportHeight: 844, scrollY };
}

test("a completed scroll command is not proof: wheel again after a measured reset until the target is in view", async () => {
  let scrollY = 0;
  let pending;
  let resetOnce = true;
  const wheels = [];
  const result = await revealTargetWithWheel({
    measure: async () => geometry(scrollY),
    wheel: async (delta) => { pending = delta; wheels.push(delta); },
    settle: async () => {
      if (pending === undefined) return;
      if (resetOnce) resetOnce = false;
      else scrollY += pending;
      pending = undefined;
    },
  });
  assert.ok(result.geometry.top >= 88 && result.geometry.bottom <= 844, JSON.stringify(result));
  assert.equal(wheels.length, 2, "The unchanged position requires another real input, never a claimed success");
});

test("a blocked page cannot be reported visible and attempts stay bounded", async () => {
  let wheels = 0;
  await assert.rejects(revealTargetWithWheel({ measure: async () => geometry(0), wheel: async () => { wheels++; }, settle: async () => {} }, { maxAttempts: 3 }), /not visible/);
  assert.equal(wheels, 3);
});

test("already visible targets require no wheel and expired deadlines fail", async () => {
  const result = await revealTargetWithWheel({ measure: async () => geometry(7000), wheel: async () => assert.fail("Already visible"), settle: async () => {} });
  assert.equal(result.attempts, 0);
  let clock = 0;
  await assert.rejects(revealTargetWithWheel({ measure: async () => geometry(0), wheel: async () => {}, settle: async () => { clock = 20; } }, { now: () => clock, timeoutMs: 10 }), /deadline/);
});
