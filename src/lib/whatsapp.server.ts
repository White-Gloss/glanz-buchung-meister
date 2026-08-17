/**
 * WHATSAPP-BENACHRICHTIGUNG AN DEN BETRIEB (serverseitig)
 * =======================================================
 * Schickt eine kurze Nachricht auf das Geschäftshandy, sobald eine
 * Terminanfrage oder eine Zustandsmeldung eingeht. Ersetzt die E-Mail nicht,
 * sondern kommt zusätzlich — eine Nachricht sieht man unterwegs, eine Mail
 * nicht immer.
 *
 * WARUM DIESE DATEI SERVERSEITIG IST
 * -----------------------------------
 * Ein Vorgänger dieser Anbindung las das Zugangstoken aus
 * `servicesConfig.ts`. Diese Datei wird von Kopfzeile, Buchungsassistent und
 * Fußzeile importiert und landet damit vollständig im Browser-Bündel. Ein
 * dort eingetragenes Token hätte jeder Besucher auslesen und in fremdem Namen
 * WhatsApp-Nachrichten verschicken können. Deshalb kommen die Zugangsdaten
 * hier ausschließlich aus den geschützten Umgebungsvariablen des Servers und
 * niemals aus einer Datei, die der Browser sieht.
 *
 * WAS MITGESCHICKT WIRD
 * ----------------------
 * Vorgangsnummer, Name, Fahrzeug, Paket, Wunschtermin und Preis. Bewusst
 * NICHT die E-Mail-Adresse und die Telefonnummer der Kundschaft: Die
 * Nachricht läuft über Meta, und für den Zweck — „es ist etwas eingegangen,
 * schau in die Verwaltung" — braucht es sie nicht. Die vollständigen Daten
 * stehen in der E-Mail und im Adminbereich.
 *
 * FEHLER BLOCKIEREN NIE EINE BUCHUNG
 * -----------------------------------
 * Jede Funktion fängt ihre Fehler selbst ab und meldet sie im Protokoll. Eine
 * gescheiterte Benachrichtigung darf niemals dazu führen, dass eine
 * Terminanfrage verlorengeht.
 */

const API_VERSION = "v21.0";
const TIMEOUT_MS = 10_000;

export type WhatsAppConfig = {
  phoneNumberId: string;
  accessToken: string;
  /** Zielnummer des Betriebs, international ohne Plus, z. B. 4915233540284. */
  to: string;
  /** Name der in Meta genehmigten Vorlage. Leer = nur Klartext möglich. */
  template: string;
  templateLanguage: string;
};

function config(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = process.env.WHATSAPP_TO?.replace(/[^\d]/g, "");
  if (!phoneNumberId || !accessToken || !to) return null;

  return {
    phoneNumberId,
    accessToken,
    to,
    template: process.env.WHATSAPP_TEMPLATE ?? "",
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANG ?? "de",
  };
}

export function whatsappConfigured(): boolean {
  return config() !== null;
}

/**
 * Zustand für den Adminbereich — ohne Token.
 *
 * Die Zielnummer wird gekürzt zurückgegeben. Sie ist zwar die eigene Nummer
 * des Betriebs und kein Geheimnis, aber es gibt keinen Grund, sie
 * vollständig durch eine Programmierschnittstelle zu schicken.
 */
export function whatsappSettingsSummary(): {
  configured: boolean;
  to: string | null;
  templateSet: boolean;
} {
  const c = config();
  if (!c) return { configured: false, to: null, templateSet: false };
  return {
    configured: true,
    to: `…${c.to.slice(-4)}`,
    templateSet: c.template.length > 0,
  };
}

export type WhatsAppResult = { sent: boolean; reason?: string };

/**
 * Eine Nachricht an den Betrieb schicken.
 *
 * ZWEI WEGE, UND WARUM ES SIE BEIDE GIBT:
 *
 * - MIT VORLAGE (`WHATSAPP_TEMPLATE`): der einzige Weg, der zu jeder Zeit
 *   funktioniert. Meta lässt vom Unternehmen ausgehende Nachrichten nur als
 *   vorab genehmigte Vorlage zu.
 * - OHNE VORLAGE: einfacher Text. Meta nimmt den nur an, wenn die Zielnummer
 *   innerhalb der letzten 24 Stunden selbst geschrieben hat. Für den
 *   Dauerbetrieb reicht das nicht, für einen schnellen Test schon.
 */
async function senden(text: string): Promise<WhatsAppResult> {
  const c = config();
  if (!c) return { sent: false, reason: "nicht eingerichtet" };

  const koerper = c.template
    ? {
        messaging_product: "whatsapp",
        to: c.to,
        type: "template",
        template: {
          name: c.template,
          language: { code: c.templateLanguage },
          components: [{ type: "body", parameters: [{ type: "text", text }] }],
        },
      }
    : {
        messaging_product: "whatsapp",
        to: c.to,
        type: "text",
        text: { body: text, preview_url: false },
      };

  try {
    const antwort = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${c.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(koerper),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!antwort.ok) {
      // Die Fehlermeldung von Meta enthält kein Token, aber zur Sicherheit
      // wird sie gekürzt und nie zusammen mit den Kopfzeilen protokolliert.
      const fehlertext = (await antwort.text()).slice(0, 400);
      return { sent: false, reason: `Meta antwortete ${antwort.status}: ${fehlertext}` };
    }

    return { sent: true };
  } catch (error) {
    const grund = error instanceof Error ? error.message : String(error);
    return { sent: false, reason: grund };
  }
}

/**
 * Öffentlicher Einstieg. Wirft nie.
 *
 * Aufgerufen wird das nicht direkt aus der Buchungsstrecke, sondern über
 * `ownerNotify.server.ts` — dort liegt die Entscheidung, welche Wege aktiv
 * sind.
 */
export async function sendWhatsApp(text: string): Promise<WhatsAppResult> {
  return senden(text);
}

/** Test aus dem Adminbereich. Hier darf der Fehler nach außen. */
export async function sendWhatsAppSelfTest(): Promise<WhatsAppResult> {
  return senden(
    "Test von white-gloss.de — die WhatsApp-Benachrichtigung ist eingerichtet. " +
      "Ab jetzt kommt hier eine Nachricht, sobald eine Anfrage eingeht.",
  );
}
