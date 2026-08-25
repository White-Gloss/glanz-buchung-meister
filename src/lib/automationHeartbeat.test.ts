import { describe, expect, it } from "vitest";

import { abstandInWorten, bewerteHeartbeat } from "./automationHeartbeat";

const JETZT = new Date("2026-08-25T12:00:00Z");
const vorStunden = (h: number) => new Date(JETZT.getTime() - h * 3_600_000).toISOString();

describe("bewerteHeartbeat", () => {
  it("meldet ein fehlendes Geheimnis als noch nicht aktiv", () => {
    const b = bewerteHeartbeat({
      secretGesetzt: false,
      letzterLauf: null,
      letzterLaufDetail: null,
      jetzt: JETZT,
    });
    expect(b.tone).toBe("pending");
    expect(b.detail).toContain("REMINDER_CRON_SECRET");
  });

  /**
   * Der Kern der Sache: Ein gesetztes Geheimnis allein durfte nie „bereit"
   * heißen. Es sagt nur, dass die Tür ein Schloss hat.
   */
  it("nennt ein gesetztes Geheimnis ohne Lauf ausdrücklich unbestätigt", () => {
    const b = bewerteHeartbeat({
      secretGesetzt: true,
      letzterLauf: null,
      letzterLaufDetail: null,
      jetzt: JETZT,
    });
    expect(b.status).toBe("Zeitgeber unbestätigt");
    expect(b.tone).toBe("pending");
  });

  it("behauptet bei fehlendem Lauf nicht, dass nichts funktioniert", () => {
    const b = bewerteHeartbeat({
      secretGesetzt: true,
      letzterLauf: null,
      letzterLaufDetail: null,
      jetzt: JETZT,
    });
    expect(b.detail).toContain("nicht zwingend");
  });

  it("meldet einen frischen Lauf als laufend und zeigt die Zähler", () => {
    const b = bewerteHeartbeat({
      secretGesetzt: true,
      letzterLauf: vorStunden(1),
      letzterLaufDetail: "kandidaten=3 versendet=3 fehlgeschlagen=0 uebersprungen=0",
      jetzt: JETZT,
    });
    expect(b.status).toBe("läuft");
    expect(b.tone).toBe("ready");
    expect(b.detail).toContain("versendet=3");
  });

  it("schlägt an, wenn der letzte Lauf zu lange her ist", () => {
    const b = bewerteHeartbeat({
      secretGesetzt: true,
      letzterLauf: vorStunden(30),
      letzterLaufDetail: null,
      jetzt: JETZT,
    });
    expect(b.status).toBe("seit Längerem still");
    expect(b.tone).toBe("pending");
    expect(b.detail).toContain("systemctl list-timers");
  });

  it("zieht die Grenze bei drei Stunden, in beide Richtungen", () => {
    const gerade = bewerteHeartbeat({
      secretGesetzt: true,
      letzterLauf: vorStunden(3),
      letzterLaufDetail: null,
      jetzt: JETZT,
    });
    const knappDrueber = bewerteHeartbeat({
      secretGesetzt: true,
      letzterLauf: new Date(JETZT.getTime() - 3 * 3_600_000 - 1_000).toISOString(),
      letzterLaufDetail: null,
      jetzt: JETZT,
    });
    expect(gerade.tone).toBe("ready");
    expect(knappDrueber.tone).toBe("pending");
  });

  it("verschluckt sich nicht an einem unbrauchbaren Zeitpunkt", () => {
    const b = bewerteHeartbeat({
      secretGesetzt: true,
      letzterLauf: "kein Datum",
      letzterLaufDetail: null,
      jetzt: JETZT,
    });
    expect(b.status).toBe("Zeitgeber unbestätigt");
  });

  it("meldet einen Lauf aus der Zukunft nicht als negative Zeit", () => {
    const b = bewerteHeartbeat({
      secretGesetzt: true,
      letzterLauf: vorStunden(-2),
      letzterLaufDetail: null,
      jetzt: JETZT,
    });
    expect(b.tone).toBe("ready");
    expect(b.detail).not.toContain("-");
  });
});

describe("abstandInWorten", () => {
  it("rundet in Stufen, die im Betrieb genügen", () => {
    expect(abstandInWorten(30_000)).toBe("gerade eben");
    expect(abstandInWorten(60_000)).toBe("vor 1 Minute");
    expect(abstandInWorten(5 * 60_000)).toBe("vor 5 Minuten");
    expect(abstandInWorten(3_600_000)).toBe("vor 1 Stunde");
    expect(abstandInWorten(5 * 3_600_000)).toBe("vor 5 Stunden");
    expect(abstandInWorten(24 * 3_600_000)).toBe("vor 1 Tag");
    expect(abstandInWorten(50 * 3_600_000)).toBe("vor 2 Tagen");
  });
});
