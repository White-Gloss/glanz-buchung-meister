import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCalendarIcs } from "./calendar-ics.ts";

test("calendar exports drop-off time without inventing a processing duration", () => {
  const text = buildCalendarIcs([{ id: 1, title: "Fahrzeug", date: "2030-01-10", slot: "09:00" }]);
  assert.match(text, /DTSTART;TZID=Europe\/Berlin:20300110T090000/);
  assert.doesNotMatch(text, /DTEND/);
  assert.match(text, /SUMMARY:Abgabe: Fahrzeug/);
  assert.match(text, /STATUS:CONFIRMED/);
  assert.match(text, /TRANSP:TRANSPARENT/);
});
test("calendar text cannot inject another event", () => {
  const text = buildCalendarIcs([
    { id: 1, title: "Kunde\r\nBEGIN:VEVENT", date: "2030-01-10", slot: "11:00" },
  ]);
  assert.equal(text.split("\r\nBEGIN:VEVENT").length, 2);
  assert.match(text, /Kunde\\nBEGIN:VEVENT/);
});
