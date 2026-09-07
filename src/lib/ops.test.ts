import assert from "node:assert/strict";
import { test } from "node:test";
import {
  berlinCalendarDate,
  berlinMinutesSinceMidnight,
  ownerNotifyTargets,
  resolveCustomerConfirmRecipients,
  resolveOwnerNotifyRecipients,
  safeExec,
  type BookingLite,
} from "./ops.ts";

const customer: BookingLite = {
  id: 41,
  customer_name: "Testkunde",
  email: "kunde@example.invalid",
  phone: "+490000123456",
  package_id: "premium",
  preferred_date: "2999-09-04",
  preferred_slot: "09:00",
};

test("owner recipients use explicit owner configuration and never the customer phone", () => {
  const keys = [
    "ADMIN_WHATSAPP_NUMBER",
    "OWNER_WHATSAPP",
    "OWNER_TELEGRAM",
    "OWNER_EMAIL",
  ] as const;
  const previous = keys.map((key) => process.env[key]);
  try {
    process.env.ADMIN_WHATSAPP_NUMBER = "+490000111111";
    process.env.OWNER_WHATSAPP = "+490000222222";
    process.env.OWNER_TELEGRAM = "test-owner";
    process.env.OWNER_EMAIL = "owner@example.invalid";
    assert.equal(ownerNotifyTargets().whatsapp, "+490000111111");
    let targets = resolveOwnerNotifyRecipients(customer);
    assert.ok(targets.some((t) => t.channel === "whatsapp" && t.to === "+490000111111"));
    assert.ok(targets.some((t) => t.channel === "email" && t.to === "owner@example.invalid"));
    assert.equal(
      targets.some((t) => t.to === customer.phone),
      false,
    );
    process.env.ADMIN_WHATSAPP_NUMBER = customer.phone;
    assert.equal(
      resolveOwnerNotifyRecipients(customer).some((t) => t.to === customer.phone),
      false,
    );
    delete process.env.ADMIN_WHATSAPP_NUMBER;
    delete process.env.OWNER_WHATSAPP;
    delete process.env.OWNER_TELEGRAM;
    targets = resolveOwnerNotifyRecipients(customer);
    assert.equal(
      targets.some((t) => t.channel !== "email"),
      false,
    );
    assert.equal(ownerNotifyTargets().whatsapp, null, "no public-site phone fallback");
  } finally {
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
  }
});

test("customer recipients require a real email and never send customer WhatsApp", () => {
  assert.deepEqual(resolveCustomerConfirmRecipients(customer), [
    { channel: "email", to: "kunde@example.invalid" },
  ]);
  for (const email of ["", customer.phone, null]) {
    assert.deepEqual(resolveCustomerConfirmRecipients({ ...customer, email }), []);
  }
});

test("Berlin date and drop-off clock handle midnight and seasonal offsets", () => {
  assert.equal(berlinCalendarDate(new Date("2026-09-06T22:30:00Z")), "2026-09-07");
  assert.equal(berlinMinutesSinceMidnight(new Date("2026-09-06T07:00:00Z")), 9 * 60);
  assert.equal(berlinMinutesSinceMidnight(new Date("2026-01-06T08:00:00Z")), 9 * 60);
});

test("secondary failure logs contain no provider or database secrets", async () => {
  const before = console.error;
  const output: unknown[][] = [];
  console.error = (...args) => {
    output.push(args);
  };
  try {
    await safeExec("test-secondary", async () => {
      throw new Error("postgres://private:secret@internal.test/customer");
    });
    assert.equal(output.length, 1);
    assert.match(String(output[0][0]), /test-secondary/);
    assert.doesNotMatch(JSON.stringify(output), /secret|postgres:|internal\.test/);
  } finally {
    console.error = before;
  }
});
