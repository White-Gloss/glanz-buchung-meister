/**
 * ANGEFANGENE BUCHUNGSANFRAGE SICHERN
 * ------------------------------------
 * Der Assistent führt durch mehrere Schritte. Wer ihn verlässt — Anruf,
 * Akku leer, versehentlich zurück — fing bisher wieder von vorn an. In der
 * Praxis heißt das meistens: gar nicht mehr.
 *
 * Der Entwurf liegt ausschließlich im Browser der Besucherin, auf ihrem
 * eigenen Gerät, mit ihren eigenen Angaben. Er wird nirgendwohin gesendet.
 *
 * RECHTLICHE EINORDNUNG (keine Rechtsberatung): § 25 Abs. 2 Nr. 2 TDDDG
 * nimmt Speicherung aus, die für einen ausdrücklich gewünschten Dienst
 * unbedingt erforderlich ist. Wer ein Anfrageformular ausfüllt, hat den
 * Dienst angefordert; seine Eingaben nicht zu verlieren, gehört dazu. Ein
 * Einwilligungsbanner ist dafür nicht vorgesehen — anders als bei Google
 * und Meta, die Reichweite messen und nicht den Dienst erbringen.
 *
 * Der Entwurf verfällt nach sieben Tagen und wird nach dem Absenden
 * gelöscht.
 */

/** Der Schlüssel trägt die Fassung: Ändert sich die Form, verfallen alte Entwürfe. */
export const DRAFT_KEY = "wg-buchung-entwurf-v1";

/** Danach ist ein Entwurf nicht mehr aussagekräftig. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type BookingDraft = {
  gespeichertAm: number;
  step: number;
  packageId: string | null;
  vehicleId: string | null;
  selectedAddOnIds: string[];
  pickupCity: string;
  conditionNote: string;
  date: string | null;
  preferredContact: string;
  customer: { name: string; email: string; phone: string; plate: string };
};

/** Die Angaben ohne Zeitstempel — so übergibt der Assistent seinen Zustand. */
export type BookingDraftInput = Omit<BookingDraft, "gespeichertAm">;

function istZeichenkette(wert: unknown): wert is string {
  return typeof wert === "string";
}

/**
 * Ist überhaupt etwas eingetragen?
 *
 * Ein leerer Entwurf soll nicht gespeichert werden — sonst bekäme jemand,
 * der die Seite nur kurz geöffnet hat, beim nächsten Besuch die Frage, ob
 * er fortsetzen möchte.
 */
export function istErwaehnenswert(entwurf: BookingDraftInput): boolean {
  return Boolean(
    entwurf.packageId ||
    entwurf.vehicleId ||
    entwurf.selectedAddOnIds.length ||
    entwurf.pickupCity ||
    entwurf.conditionNote.trim() ||
    entwurf.date ||
    entwurf.customer.name.trim() ||
    entwurf.customer.email.trim() ||
    entwurf.customer.phone.trim() ||
    entwurf.customer.plate.trim(),
  );
}

export function serialisieren(entwurf: BookingDraftInput, jetzt: number): string {
  return JSON.stringify({ ...entwurf, gespeichertAm: jetzt } satisfies BookingDraft);
}

/**
 * Liest einen gespeicherten Entwurf.
 *
 * Gibt `null` zurück, wenn nichts da ist, der Text unlesbar ist, die Form
 * nicht stimmt oder der Entwurf zu alt ist. Fremde oder beschädigte Daten
 * dürfen den Assistenten nicht in einen unmöglichen Zustand versetzen —
 * lieber von vorn beginnen als halb gefüllt weitermachen.
 */
export function lesen(roh: string | null, jetzt: number): BookingDraft | null {
  if (!roh) return null;

  let wert: unknown;
  try {
    wert = JSON.parse(roh);
  } catch {
    return null;
  }
  if (!wert || typeof wert !== "object") return null;

  const d = wert as Record<string, unknown>;
  if (typeof d.gespeichertAm !== "number" || !Number.isFinite(d.gespeichertAm)) return null;
  if (jetzt - d.gespeichertAm > DRAFT_MAX_AGE_MS) return null;
  // Ein Zeitstempel aus der Zukunft deutet auf eine verstellte Uhr hin.
  if (d.gespeichertAm > jetzt + 60_000) return null;

  const kunde = (d.customer ?? {}) as Record<string, unknown>;
  const addOns = Array.isArray(d.selectedAddOnIds)
    ? d.selectedAddOnIds.filter(istZeichenkette)
    : [];

  return {
    gespeichertAm: d.gespeichertAm,
    step: typeof d.step === "number" && d.step >= 0 && d.step < 20 ? Math.floor(d.step) : 0,
    packageId: istZeichenkette(d.packageId) ? d.packageId : null,
    vehicleId: istZeichenkette(d.vehicleId) ? d.vehicleId : null,
    selectedAddOnIds: [...new Set(addOns)],
    pickupCity: istZeichenkette(d.pickupCity) ? d.pickupCity : "",
    conditionNote: istZeichenkette(d.conditionNote) ? d.conditionNote.slice(0, 4000) : "",
    date: istZeichenkette(d.date) && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
    preferredContact: istZeichenkette(d.preferredContact) ? d.preferredContact : "E-Mail",
    customer: {
      name: istZeichenkette(kunde.name) ? kunde.name.slice(0, 120) : "",
      email: istZeichenkette(kunde.email) ? kunde.email.slice(0, 160) : "",
      phone: istZeichenkette(kunde.phone) ? kunde.phone.slice(0, 40) : "",
      plate: istZeichenkette(kunde.plate) ? kunde.plate.slice(0, 20) : "",
    },
  };
}

/** Wie lange der Entwurf schon liegt — für den Hinweis an die Besucherin. */
export function alterInTagen(entwurf: BookingDraft, jetzt: number): number {
  return Math.floor((jetzt - entwurf.gespeichertAm) / (24 * 60 * 60 * 1000));
}
