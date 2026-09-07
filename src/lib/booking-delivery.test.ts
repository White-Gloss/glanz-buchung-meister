import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeliveryKick } from "./booking-delivery.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));
test("background delivery returns immediately, combines overlapping kicks and catches the last-claim race", async () => {
  let calls = 0,
    release!: () => void;
  const latch = new Promise<void>((resolve) => {
    release = resolve;
  });
  const kick = createDeliveryKick(
    async () => {
      calls++;
      if (calls === 1) await latch;
    },
    () => assert.fail("unexpected failure"),
  );
  kick();
  assert.equal(calls, 1);
  kick();
  kick();
  assert.equal(calls, 1);
  release();
  await tick();
  assert.equal(calls, 2);
  kick();
  await tick();
  assert.equal(calls, 3);
});
test("worker failure does not reject a committed booking or spin forever", async () => {
  let calls = 0,
    errors = 0;
  const kick = createDeliveryKick(
    async () => {
      calls++;
      throw new Error("isolated database failure");
    },
    () => {
      errors++;
    },
  );
  kick();
  await tick();
  assert.equal(calls, 1);
  assert.equal(errors, 1);
  kick();
  await tick();
  assert.equal(calls, 2);
  assert.equal(errors, 2);
});
