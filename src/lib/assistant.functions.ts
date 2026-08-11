import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * ZUGANG ZUM KI-ASSISTENTEN
 * --------------------------
 * Jede Funktion hier ist auf Administratoren beschränkt. Der Assistent sieht
 * Kundendaten; ein offener Endpunkt wäre gleichbedeutend mit einem offenen
 * Kundenverzeichnis.
 *
 * Der eigentliche Modellzugriff liegt in `assistant.server.ts` und wird
 * dynamisch nachgeladen, damit das SDK nicht in Bündel gerät, die es nicht
 * brauchen.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

/** Freitext des Betriebs — begrenzt, damit keine unbeabsichtigten Riesenanfragen entstehen. */
function limitText(value: unknown, feld: string, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) {
    throw new Error(`${feld} ist zu lang (höchstens ${max} Zeichen).`);
  }
  return text;
}

export type AssistantStatus = { configured: boolean };

/**
 * Ist der Assistent überhaupt eingerichtet? Der Adminbereich blendet ihn sonst
 * vollständig aus, statt einen Knopf zu zeigen, der nur Fehler wirft.
 */
export const getAssistantStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssistantStatus> => {
    await assertAdmin(context);
    const { assistantConfigured } = await import("./assistant.server");
    return { configured: assistantConfigured() };
  });

/* ------------------------------------------------------------------ */

export const draftCustomerReply = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { bookingId: string; kind: string; hinweis?: string }) => data)
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.bookingId)) throw new Error("Ungültige Buchungs-ID.");

    const erlaubt = ["gegenangebot", "rueckfrage", "absage", "bestaetigung"] as const;
    type Kind = (typeof erlaubt)[number];
    if (!erlaubt.includes(data.kind as Kind)) throw new Error("Unbekannte Entwurfsart.");

    const hinweis = limitText(data.hinweis, "Die zusätzliche Anweisung", 2000);

    // Bewusst über die bestehende, bereits abgesicherte Liste statt über eine
    // eigene Abfrage: So gilt für den Assistenten genau derselbe Zugriffsweg
    // wie für die Buchungsübersicht.
    const { listBookings } = await import("./bookings.functions");
    const booking = (await listBookings()).find((b) => b.id === data.bookingId);
    if (!booking) throw new Error("Die Buchung wurde nicht gefunden.");

    const { draftReply } = await import("./assistant.server");
    const ergebnis = await draftReply({
      booking,
      kind: data.kind as Kind,
      hinweis: hinweis || undefined,
    });
    return { text: ergebnis.text };
  });

/* ------------------------------------------------------------------ */

export const askAboutBookings = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { frage: string }) => data)
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    await assertAdmin(context);
    const frage = limitText(data.frage, "Die Frage", 1000);
    if (frage.length < 3) throw new Error("Bitte stellen Sie eine Frage.");

    const { listBookings } = await import("./bookings.functions");
    const bookings = await listBookings();

    const { answerAboutBookings } = await import("./assistant.server");
    const ergebnis = await answerAboutBookings({ frage, bookings });
    return { text: ergebnis.text };
  });

/* ------------------------------------------------------------------ */

export const draftText = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { kind: string; thema: string }) => data)
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    await assertAdmin(context);

    const erlaubt = ["ratgeber", "faq", "ortstext"] as const;
    type Kind = (typeof erlaubt)[number];
    if (!erlaubt.includes(data.kind as Kind)) throw new Error("Unbekannte Textart.");

    const thema = limitText(data.thema, "Das Thema", 500);
    if (thema.length < 3) throw new Error("Bitte geben Sie ein Thema an.");

    const { draftWebsiteText } = await import("./assistant.server");
    const ergebnis = await draftWebsiteText({ kind: data.kind as Kind, thema });
    return { text: ergebnis.text };
  });

/* ------------------------------------------------------------------ */

/**
 * BILDBEWERTUNG EINER ZUSTANDSMELDUNG
 * ------------------------------------
 * Die einzige Stelle im Projekt, an der Fotos aus dem privaten Bucket den
 * Server verlassen. Das passiert ausschließlich auf ausdrücklichen Knopfdruck
 * im Adminbereich — nie automatisch beim Eingang einer Meldung.
 *
 * Warum diese Grenzen:
 *
 * - VIDEOS werden übersprungen. Die Schnittstelle nimmt nur Bilder entgegen;
 *   ein Video stumm mitzuschicken ginge schief, es kommentarlos wegzulassen
 *   wäre irreführend. Beides wird im Ergebnis benannt.
 * - GROSSE DATEIEN werden übersprungen. Über etwa 3,7 MB weist die
 *   Schnittstelle ein Bild ohnehin ab; besser vorher aussortieren und sagen,
 *   welches fehlt, als die ganze Anfrage scheitern zu lassen.
 * - KEINE KONTAKTDATEN. Mitgeschickt werden Fahrzeug, Kennzeichen und die
 *   Zustandsbeschreibung — nicht Name, E-Mail oder Telefonnummer.
 */

/** Je Bild; die Schnittstelle lehnt darüber ab (5 MB nach Base64-Kodierung). */
const MAX_BILD_BYTES = 3_700_000;
/** Über alle Bilder zusammen, damit eine Anfrage nicht ins Uferlose läuft. */
const MAX_GESAMT_BYTES = 15_000_000;

const BILD_TYPEN: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function dateiname(pfad: string): string {
  return pfad.split("/").pop() ?? pfad;
}

export const assessConditionPhotos = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { reportId: string }) => data)
  .handler(async ({ data, context }): Promise<{ text: string; ausgelassen: string[] }> => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.reportId)) throw new Error("Ungültige Meldungs-ID.");

    const { queryOne } = await import("./db.server");
    const report = await queryOne<{
      vehicle: string;
      plate: string;
      condition_text: string;
      photo_paths: string[];
      booking_id: string | null;
    }>(
      `SELECT vehicle, plate, condition_text, photo_paths, booking_id
         FROM public.condition_reports WHERE id = $1`,
      [data.reportId],
    );
    if (!report) throw new Error("Die Meldung wurde nicht gefunden.");
    if (report.photo_paths.length === 0) {
      throw new Error("Zu dieser Meldung gibt es keine Aufnahmen.");
    }

    const { CONDITION_PHOTO_BUCKET } = await import("./conditionReports.functions");

    const photos: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string }[] = [];
    const ausgelassen: string[] = [];
    let gesamt = 0;

    for (const pfad of report.photo_paths) {
      const endung = pfad.split(".").pop()?.toLowerCase() ?? "";
      const mediaType = BILD_TYPEN[endung];
      if (!mediaType) {
        ausgelassen.push(
          `${dateiname(pfad)} (Video — Bilder können beurteilt werden, Videos nicht)`,
        );
        continue;
      }

      const { data: blob, error } = await context.supabase.storage
        .from(CONDITION_PHOTO_BUCKET)
        .download(pfad);
      if (error || !blob) {
        ausgelassen.push(`${dateiname(pfad)} (konnte nicht geladen werden)`);
        continue;
      }

      const bytes = Buffer.from(await blob.arrayBuffer());
      if (bytes.byteLength > MAX_BILD_BYTES) {
        ausgelassen.push(`${dateiname(pfad)} (zu groß für die Bildprüfung)`);
        continue;
      }
      if (gesamt + bytes.byteLength > MAX_GESAMT_BYTES) {
        ausgelassen.push(`${dateiname(pfad)} (Gesamtumfang der Anfrage erreicht)`);
        continue;
      }

      gesamt += bytes.byteLength;
      photos.push({ mediaType, base64: bytes.toString("base64") });
    }

    if (photos.length === 0) {
      throw new Error(
        "Zu dieser Meldung liegt kein auswertbares Foto vor. Videos und sehr große Dateien lassen sich nicht prüfen.",
      );
    }

    let booking;
    if (report.booking_id) {
      const { listBookings } = await import("./bookings.functions");
      booking = (await listBookings()).find((b) => b.id === report.booking_id);
    }

    const { assessPhotos } = await import("./assistant.server");
    const ergebnis = await assessPhotos({
      context: {
        vehicle: report.vehicle,
        plate: report.plate,
        conditionText: report.condition_text,
        booking,
        ausgelassen,
      },
      photos,
    });

    return { text: ergebnis.text, ausgelassen };
  });
