import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  canAutoConfirmAppointment,
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
    assert.equal(
      withoutMail.some((t) => t.channel === "whatsapp"),
      false,
    );
    assert.equal(
      withoutMail.some((t) => t.channel === "telegram"),
      false,
    );
  });
});

describe("automatic appointment confirmation", () => {
  const base = {
    kind: "booking",
    packageId: "premium",
    preferredDate: "2026-09-04",
    preferredSlot: "09:00",
    occupied: [] as { date: string; slot: string | null; packageId: string }[],
    today: "2026-09-01",
    nowMinutes: 8 * 60,
  };

  it("confirms a free weekday slot", () => {
    assert.deepEqual(canAutoConfirmAppointment(base), { ok: true });
  });

  it("keeps photo and dent requests manual", () => {
    assert.equal(canAutoConfirmAppointment({ ...base, kind: "dent" }).ok, false);
    assert.equal(canAutoConfirmAppointment({ ...base, kind: "condition" }).ok, false);
  });

  it("does not confirm without a date, on weekends, or in the past", () => {
    assert.equal(canAutoConfirmAppointment({ ...base, preferredDate: null }).ok, false);
    assert.equal(canAutoConfirmAppointment({ ...base, preferredDate: "2026-09-05" }).ok, false);
    assert.equal(canAutoConfirmAppointment({ ...base, preferredDate: "2026-08-31" }).ok, false);
  });

  it("does not confirm a slot that is already taken or a full day", () => {
    assert.equal(
      canAutoConfirmAppointment({
        ...base,
        occupied: [{ date: "2026-09-04", slot: "09:00", packageId: "basis" }],
      }).ok,
      false,
    );
    assert.equal(
      canAutoConfirmAppointment({
        ...base,
        preferredSlot: "15:00",
        occupied: [
          { date: "2026-09-04", slot: "09:00", packageId: "basis" },
          { date: "2026-09-04", slot: "11:00", packageId: "premium" },
        ],
      }).ok,
      false,
    );
  });

  it("keeps ceramic as a full-day job", () => {
    assert.equal(
      canAutoConfirmAppointment({
        ...base,
        packageId: "keramik",
        occupied: [{ date: "2026-09-04", slot: "15:00", packageId: "basis" }],
      }).ok,
      false,
    );
    assert.equal(
      canAutoConfirmAppointment({
        ...base,
        occupied: [{ date: "2026-09-04", slot: "15:00", packageId: "keramik" }],
      }).ok,
      false,
    );
  });

  it("does not confirm a slot that has already started today", () => {
    assert.equal(
      canAutoConfirmAppointment({
        ...base,
        preferredDate: "2026-09-01",
        preferredSlot: "09:00",
        today: "2026-09-01",
        nowMinutes: 10 * 60,
      }).ok,
      false,
    );
  });
});

describe("auto-confirm copy", () => {
  it("explains automatic yes and keeps forbidden public strings out", () => {
    const danke = readFileSync(fileURLToPath(new URL("../routes/danke.tsx", import.meta.url)), "utf8");
    const auto = readFileSync(
      fileURLToPath(new URL("../routes/admin.automatisierung.tsx", import.meta.url)),
      "utf8",
    );
    const bookingFn = readFileSync(fileURLToPath(new URL("./bookings.functions.ts", import.meta.url)), "utf8");
    assert.equal(/Termin ist zugesagt/.test(danke), true);
    assert.equal(/automatisch zugesagt/.test(auto), true);
    assert.equal(/AUTO_CONFIRM_ACTOR/.test(bookingFn), true);
    for (const src of [danke, auto, bookingFn]) {
      assert.equal(/Konto anlegen/.test(src), false);
      assert.equal(/Weiter mit X/.test(src), false);
    }
  });
});
