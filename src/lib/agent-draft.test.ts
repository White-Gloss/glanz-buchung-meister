import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReplyDraft } from "./agent-draft.ts";

describe("buildReplyDraft", () => {
  it("schreibt Du-Form-Nähe, nennt Absender und fragt nicht nach erfundenen Daten", () => {
    const text = buildReplyDraft({
      sender: "Max Mustermann",
      subject: "Anfrage Signature",
      body: "Hallo, ich hätte gern einen Termin nächste Woche für mein SUV.",
      packageHint: "Signature",
    });
    assert.match(text, /Max Mustermann/);
    assert.match(text, /Signature|Termin/i);
    assert.doesNotMatch(text, /IBAN|Steuer/);
  });

  it("fällt auf Kunde zurück wenn sender fehlt", () => {
    const text = buildReplyDraft({
      sender: null,
      subject: null,
      body: "Anfrage",
    });
    assert.match(text, /Guten Tag Kunde/);
  });
});
