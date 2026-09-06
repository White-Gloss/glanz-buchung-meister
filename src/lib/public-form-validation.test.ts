import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bookingFormErrors, photoInquiryErrors } from "./public-form-validation.ts";

const contact = { name: "Anna Test", phone: "+49 123456789", privacy: true };
const booking = { ...contact, email: "", date: "", note: "" };
const today = "2026-09-06";

describe("public form feedback before submitting", () => {
  it("identifies short or whitespace-only contact values instead of sending a doomed request", () => {
    for (const [name, phone] of [
      ["A", "1"],
      ["  ", "      "],
    ]) {
      const errors = bookingFormErrors({ ...booking, name, phone }, today);
      assert.deepEqual(Object.keys(errors).sort(), ["name", "phone"]);
      const photoErrors = photoInquiryErrors({
        ...contact,
        name,
        phone,
        text: "Prüfung",
        files: [],
      });
      assert.deepEqual(Object.keys(photoErrors).sort(), ["name", "phone"]);
    }
  });

  it("accepts the existing server contact limits and trims outer whitespace", () => {
    for (const [name, phone] of [
      ["  An  ", "  123456  "],
      ["N".repeat(120), "1".repeat(40)],
    ]) {
      assert.deepEqual(bookingFormErrors({ ...booking, name, phone }, today), {});
    }
    const errors = bookingFormErrors(
      { ...booking, name: "N".repeat(121), phone: "1".repeat(41) },
      today,
    );
    assert.deepEqual(Object.keys(errors).sort(), ["name", "phone"]);
  });

  it("allows optional booking fields and today, and associates invalid values with their fields", () => {
    assert.deepEqual(bookingFormErrors(booking, today), {});
    assert.deepEqual(
      bookingFormErrors(
        { ...booking, date: today, email: "test@example.org", note: "x".repeat(2000) },
        today,
      ),
      {},
    );
    const errors = bookingFormErrors(
      { ...booking, privacy: false, date: "2026-09-05", email: "test@", note: "x".repeat(2001) },
      today,
    );
    assert.deepEqual(Object.keys(errors).sort(), ["date", "email", "note", "privacy"]);
  });

  it("accepts a photo inquiry with either a description or a filename", () => {
    assert.deepEqual(photoInquiryErrors({ ...contact, text: "Delle an der Tür", files: [] }), {});
    assert.deepEqual(
      photoInquiryErrors({ ...contact, text: "", files: [{ name: "fahrzeug.jpg" }] }),
      {},
    );
    assert.ok(photoInquiryErrors({ ...contact, text: "  ", files: [] }).text);
  });

  it("explains oversized description and filename values before contacting the server", () => {
    const errors = photoInquiryErrors({
      ...contact,
      text: "x".repeat(2001),
      files: [{ name: "x".repeat(181) }],
    });
    assert.deepEqual(Object.keys(errors).sort(), ["media", "text"]);
  });
});
