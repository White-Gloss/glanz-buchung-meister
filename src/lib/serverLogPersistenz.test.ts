import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Die Ablage darf die Anwendung unter keinen Umständen stören. Deshalb hier
 * der unfreundlichste Fall: Die Datenbankschicht scheitert bei jedem Aufruf —
 * so verhält sie sich, solange die Migration nicht eingespielt ist.
 */
vi.mock("./db.server", () => ({
  query: vi.fn(() => Promise.reject(new Error('relation "system_events" does not exist'))),
}));

const { protokollFehler, protokollHinweis, protokollAusnahme } = await import("./serverLog");

afterEach(() => {
  vi.restoreAllMocks();
});

/** Wartet die Mikrotasks ab, in denen die Ablage läuft. */
async function abwarten() {
  await new Promise((fertig) => setTimeout(fertig, 0));
}

describe("Ablage des Störungsprotokolls", () => {
  it("does not throw when the table is missing", async () => {
    const konsole = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      protokollFehler("mail", "Versand fehlgeschlagen", new Error("kaputt")),
    ).not.toThrow();
    await abwarten();

    // Die Konsolenzeile steht trotzdem — sie ist der verlässliche Teil.
    expect(konsole).toHaveBeenCalledTimes(1);
    expect(konsole.mock.calls[0][0]).toContain("[mail] Versand fehlgeschlagen");
  });

  it("swallows the failure for hints and exceptions as well", async () => {
    const fehler = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnung = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => protokollHinweis("mail", "nicht eingerichtet")).not.toThrow();
    expect(() => protokollAusnahme("server", "Anfrage abgebrochen", new Error("x"))).not.toThrow();
    await abwarten();

    expect(warnung).toHaveBeenCalledTimes(1);
    expect(fehler).toHaveBeenCalledTimes(1);
  });

  it("produces no unhandled rejection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const unbehandelt = vi.fn();
    process.on("unhandledRejection", unbehandelt);

    protokollFehler("erpnext", "Abgleich fehlgeschlagen", new Error("kaputt"));
    await abwarten();
    await abwarten();

    process.off("unhandledRejection", unbehandelt);
    expect(unbehandelt).not.toHaveBeenCalled();
  });
});
