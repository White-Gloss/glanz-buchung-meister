import { describe, expect, it } from "vitest";
import {
  CLEANUP_GRACE_DAYS,
  megabyte,
  planCleanup,
  type StoredMedia,
} from "./conditionMediaCleanup";

const JETZT = Date.parse("2026-08-17T12:00:00Z");
const vorTagen = (tage: number) => new Date(JETZT - tage * 24 * 60 * 60_000).toISOString();

describe("planCleanup", () => {
  it("fasst Aufnahmen, die zu einer Meldung gehören, niemals an", () => {
    const dateien: StoredMedia[] = [
      { path: "a/1.jpg", createdAt: vorTagen(400), sizeBytes: 1000 },
      { path: "b/2.jpg", createdAt: vorTagen(999), sizeBytes: 1000 },
    ];

    const plan = planCleanup(dateien, ["a/1.jpg", "b/2.jpg"], JETZT);

    expect(plan.loeschen).toEqual([]);
    expect(plan.inVerwendung).toBe(2);
    expect(plan.bytes).toBe(0);
  });

  it("schont Aufnahmen innerhalb der Schonfrist, auch ohne Meldung", () => {
    const dateien: StoredMedia[] = [
      { path: "a/heute.jpg", createdAt: vorTagen(0) },
      { path: "a/gestern.jpg", createdAt: vorTagen(1) },
      { path: "a/knapp.jpg", createdAt: vorTagen(CLEANUP_GRACE_DAYS - 0.1) },
    ];

    const plan = planCleanup(dateien, [], JETZT);

    expect(plan.loeschen).toEqual([]);
    expect(plan.geschont).toBe(3);
  });

  it("entfernt nur Verwaistes jenseits der Schonfrist", () => {
    const dateien: StoredMedia[] = [
      { path: "a/alt.jpg", createdAt: vorTagen(CLEANUP_GRACE_DAYS + 1), sizeBytes: 2_000_000 },
      { path: "b/neu.jpg", createdAt: vorTagen(1), sizeBytes: 9_000_000 },
      { path: "c/inbenutzung.jpg", createdAt: vorTagen(90), sizeBytes: 9_000_000 },
    ];

    const plan = planCleanup(dateien, ["c/inbenutzung.jpg"], JETZT);

    expect(plan.loeschen).toEqual(["a/alt.jpg"]);
    expect(plan.geschont).toBe(1);
    expect(plan.inVerwendung).toBe(1);
    expect(megabyte(plan.bytes)).toBe(1.91);
  });

  // Im Zweifel bleibt die Datei liegen. Ein fehlendes Datum darf nicht
  // versehentlich als „uralt" durchgehen.
  it("schont Aufnahmen mit unbekanntem oder unlesbarem Datum", () => {
    const dateien: StoredMedia[] = [
      { path: "a/ohne.jpg" },
      { path: "b/null.jpg", createdAt: null },
      { path: "c/kaputt.jpg", createdAt: "kein datum" },
    ];

    const plan = planCleanup(dateien, [], JETZT);

    expect(plan.loeschen).toEqual([]);
    expect(plan.geschont).toBe(3);
  });

  it("kommt mit fehlenden Größenangaben zurecht", () => {
    const dateien: StoredMedia[] = [
      { path: "a/x.jpg", createdAt: vorTagen(30) },
      { path: "b/y.jpg", createdAt: vorTagen(30), sizeBytes: null },
      { path: "c/z.jpg", createdAt: vorTagen(30), sizeBytes: 1024 },
    ];

    const plan = planCleanup(dateien, [], JETZT);

    expect(plan.loeschen).toHaveLength(3);
    expect(plan.bytes).toBe(1024);
  });

  it("bildet den heutigen Stand des Speichers korrekt ab", () => {
    // Nachgestellt aus dem echten Speicher: 12 Aufnahmen gehören zu
    // Meldungen, 7 sind verwaist und älter als die Schonfrist.
    const inVerwendung = Array.from({ length: 12 }, (_, i) => `m${i}/datei.jpg`);
    const dateien: StoredMedia[] = [
      ...inVerwendung.map((path) => ({ path, createdAt: vorTagen(10), sizeBytes: 1_000_000 })),
      ...Array.from({ length: 7 }, (_, i) => ({
        path: `w${i}/datei.jpg`,
        createdAt: vorTagen(9),
        sizeBytes: 1_058_000,
      })),
    ];

    const plan = planCleanup(dateien, inVerwendung, JETZT);

    expect(plan.inVerwendung).toBe(12);
    expect(plan.geschont).toBe(0);
    expect(plan.loeschen).toHaveLength(7);
    expect(megabyte(plan.bytes)).toBe(7.06);
  });
});
