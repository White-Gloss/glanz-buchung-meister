import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveCustomerConfirmRecipients,
  resolveOwnerNotifyRecipients,
  type BookingLite,
} from "./ops.ts";

const customer: BookingLite = {
  id: 41,
  customer_name: "Testkunde",
  email: "kunde@example.com",
  phone: "+491701112233",
  package_id: "premium",
  preferred_date: "2026-09-04",
  preferred_slot: "09:00",
};

describe("owner notify recipients", () => {
  it("never uses the customer phone as owner WhatsApp or Telegram target", () => {
    const prevWa = process.env.OWNER_WHATSAPP;
    const prevTg = process.env.OWNER_TELEGRAM;
    const prevMail = process.env.OWNER_EMAIL;
    process.env.OWNER_WHATSAPP = "+4915233540284";
    process.env.OWNER_TELEGRAM = "123456789";
    process.env.OWNER_EMAIL = "info@white-gloss.de";
    try {
      const targets = resolveOwnerNotifyRecipients(customer);
      assert.equal(
        targets.some((t) => t.to === customer.phone),
        false,
      );
      assert.ok(targets.some((t) => t.channel === "whatsapp" && t.to === "+4915233540284"));
      assert.ok(targets.some((t) => t.channel === "telegram" && t.to === "123456789"));
      assert.ok(targets.some((t) => t.channel === "email" && t.to === "info@white-gloss.de"));
    } finally {
      if (prevWa === undefined) delete process.env.OWNER_WHATSAPP;
      else process.env.OWNER_WHATSAPP = prevWa;
      if (prevTg === undefined) delete process.env.OWNER_TELEGRAM;
      else process.env.OWNER_TELEGRAM = prevTg;
      if (prevMail === undefined) delete process.env.OWNER_EMAIL;
      else process.env.OWNER_EMAIL = prevMail;
    }
  });

  it("skips Telegram when no owner chat is configured", () => {
    const prevTg = process.env.OWNER_TELEGRAM;
    delete process.env.OWNER_TELEGRAM;
    try {
      const targets = resolveOwnerNotifyRecipients(customer);
      assert.equal(
        targets.some((t) => t.channel === "telegram"),
        false,
      );
    } finally {
      if (prevTg === undefined) delete process.env.OWNER_TELEGRAM;
      else process.env.OWNER_TELEGRAM = prevTg;
    }
  });

  it("does not fall back to the customer phone when OWNER_WHATSAPP is unset", () => {
    const prevWa = process.env.OWNER_WHATSAPP;
    const prevTg = process.env.OWNER_TELEGRAM;
    delete process.env.OWNER_WHATSAPP;
    delete process.env.OWNER_TELEGRAM;
    try {
      const targets = resolveOwnerNotifyRecipients(customer);
      assert.equal(
        targets.some((t) => t.to === customer.phone),
        false,
      );
      assert.equal(
        targets.filter((t) => t.channel === "whatsapp").every((t) => t.to !== customer.phone),
        true,
      );
    } finally {
      if (prevWa === undefined) delete process.env.OWNER_WHATSAPP;
      else process.env.OWNER_WHATSAPP = prevWa;
      if (prevTg === undefined) delete process.env.OWNER_TELEGRAM;
      else process.env.OWNER_TELEGRAM = prevTg;
    }
  });
});

describe("customer confirmation recipients", () => {
  it("queues email only to a real address, never to the phone number", () => {
    const withMail = resolveCustomerConfirmRecipients(customer);
    assert.ok(withMail.some((t) => t.channel === "email" && t.to === "kunde@example.com"));
    assert.equal(
      withMail.some((t) => t.channel === "email" && t.to === customer.phone),
      false,
    );
    const withoutMail = resolveCustomerConfirmRecipients({ ...customer, email: "" });
    assert.equal(
      withoutMail.some((t) => t.channel === "email"),
      false,
    );
    assert.ok(withoutMail.some((t) => t.channel === "whatsapp" && t.to === customer.phone));
    assert.equal(
      withoutMail.some((t) => t.channel === "telegram"),
      false,
    );
  });
});
