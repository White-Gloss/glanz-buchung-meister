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
