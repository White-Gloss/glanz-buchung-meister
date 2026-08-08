/**
 * WhatsApp Cloud API (Meta) – Automatisierte Kundenkommunikation
 * ===============================================================
 *
 * Voraussetzungen:
 *   1. Meta Business Suite → WhatsApp → API Setup
 *   2. Phone Number ID + Permanent Access Token
 *   3. Template-Nachrichten in Meta genehmigt
 *
 * Trage die Werte in `src/lib/servicesConfig.ts` unter `company.whatsapp` ein:
 *   - phoneNumberId  (aus API Setup, z. B. "123456789")
 *   - accessToken    (System User Token, nie teilen!)
 *   - templates.bookingConfirmation
 *   - templates.followUpAfterService
 *   - templates.reminderDayBefore
 *
 * Nutzung nach Token-Einrichtung:
 *   import { sendBookingConfirmation, sendFollowUp, sendReminder } from "./whatsapp";
 *   await sendBookingConfirmation("+4917612345678", "Max Mustermann", "12.08.2026", "10:00");
 */

import { company } from "./servicesConfig";

const API_BASE = "https://graph.facebook.com/v21.0";

interface WhatsAppResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
  error?: { message: string; type: string; code: number };
}

async function sendTemplateMessage(
  customerPhone: string,
  templateName: string,
  language: string,
  bodyParams?: string[],
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { phoneNumberId, accessToken } = company.whatsapp;

  if (!phoneNumberId || !accessToken) {
    console.warn("WhatsApp API nicht konfiguriert (phoneNumberId/accessToken fehlt)");
    return { success: false, error: "API not configured" };
  }

  // Entferne führende 0/00/+ – die API erwartet internationales Format mit Ländercode
  const cleanPhone = customerPhone.replace(/^0+/, "").replace(/^\+/, "");
  const recipient = cleanPhone.startsWith("49") ? cleanPhone : `49${cleanPhone}`;

  const components: Record<string, unknown>[] = [];
  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    });
  }

  try {
    const res = await fetch(`${API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components,
        },
      }),
    });

    const data: WhatsAppResponse = await res.json();

    if (!res.ok || data.error) {
      console.error("WhatsApp API Fehler:", data.error?.message);
      return { success: false, error: data.error?.message };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error("WhatsApp API Netzwerkfehler:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Terminbestätigung direkt nach Buchung senden.
 * Template benötigt Parameter: {{1}}=Name, {{2}}=Datum, {{3}}=Uhrzeit
 */
export async function sendBookingConfirmation(
  customerPhone: string,
  customerName: string,
  date: string,
  time: string,
): Promise<{ success: boolean }> {
  const templateName = company.whatsapp.templates.bookingConfirmation || "booking_confirmation_de";
  return sendTemplateMessage(customerPhone, templateName, "de", [customerName, date, time]);
}

/**
 * Follow-up 3 Tage nach Service: Zufriedenheitsabfrage + Bewertungsanfrage.
 * Template benötigt Parameter: {{1}}=Name
 */
export async function sendFollowUp(
  customerPhone: string,
  customerName: string,
): Promise<{ success: boolean }> {
  const templateName = company.whatsapp.templates.followUpAfterService || "follow_up_service_de";
  return sendTemplateMessage(customerPhone, templateName, "de", [customerName]);
}

/**
 * Erinnerung 1 Tag vor Termin.
 * Template benötigt Parameter: {{1}}=Name, {{2}}=Datum, {{3}}=Uhrzeit
 */
export async function sendReminder(
  customerPhone: string,
  customerName: string,
  date: string,
  time: string,
): Promise<{ success: boolean }> {
  const templateName = company.whatsapp.templates.reminderDayBefore || "reminder_day_before_de";
  return sendTemplateMessage(customerPhone, templateName, "de", [customerName, date, time]);
}

/**
 * Schreibt eine Freitext-Nachricht (KEIN Template – nur für Kunden, die
 * zuerst geschrieben haben, innerhalb des 24h-Fensters).
 */
export async function sendTextMessage(
  customerPhone: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  const { phoneNumberId, accessToken } = company.whatsapp;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: "API not configured" };
  }

  const cleanPhone = customerPhone.replace(/^0+/, "").replace(/^\+/, "");
  const recipient = cleanPhone.startsWith("49") ? cleanPhone : `49${cleanPhone}`;

  try {
    const res = await fetch(`${API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { body: text },
      }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false };
    return { success: true };
  } catch {
    return { success: false };
  }
}
