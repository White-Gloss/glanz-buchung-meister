import { describe, expect, it } from "vitest";

import { interpretAssistantAnswer, TRUNCATION_NOTICE } from "./assistantAnswer";

describe("interpretAssistantAnswer", () => {
  it("returns a finished answer unchanged", () => {
    expect(
      interpretAssistantAnswer({
        stopReason: "end_turn",
        text: "  Betreff: Ihr Termin\n\nGuten Tag  ",
      }),
    ).toEqual({ text: "Betreff: Ihr Termin\n\nGuten Tag", truncated: false });
  });

  it("marks an answer that ran into the length limit", () => {
    const result = interpretAssistantAnswer({
      stopReason: "max_tokens",
      text: "Betreff: Ihr Termin\n\nGuten Tag, wir haben Ihr Fahrzeug",
    });

    expect(result.truncated).toBe(true);
    expect(result.text).toContain("Guten Tag, wir haben Ihr Fahrzeug");
    expect(result.text).toContain(TRUNCATION_NOTICE);
  });

  it("rejects a refusal before anything is read", () => {
    expect(() => interpretAssistantAnswer({ stopReason: "refusal", text: "" })).toThrow(
      /abgelehnt/,
    );
    // Auch mit Restinhalt bleibt es eine Ablehnung.
    expect(() => interpretAssistantAnswer({ stopReason: "refusal", text: "Teiltext" })).toThrow(
      /abgelehnt/,
    );
  });

  it("names the cause when the limit was reached before any text", () => {
    expect(() => interpretAssistantAnswer({ stopReason: "max_tokens", text: "   " })).toThrow(
      /Längengrenze/,
    );
  });

  it("falls back to the general message for an empty answer", () => {
    expect(() => interpretAssistantAnswer({ stopReason: "end_turn", text: "" })).toThrow(
      /keine verwertbare Antwort/,
    );
    expect(() => interpretAssistantAnswer({ stopReason: null, text: "" })).toThrow(
      /keine verwertbare Antwort/,
    );
  });
});
