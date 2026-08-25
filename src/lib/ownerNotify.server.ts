/**
 * SOFORTBENACHRICHTIGUNG AN DEN BETRIEB
 * ======================================
 * Eine Stelle, die entscheidet, über welche Wege eine Meldung hinausgeht.
 * Derzeit zwei: Telegram und WhatsApp.
 *
 * WARUM EIN VERTEILER STATT DIREKTER AUFRUFE
 * -------------------------------------------
 * Die Einbaustellen — neue Buchung, neue Zustandsmeldung — sollen nicht
 * wissen müssen, welche Kanäle es gibt. Sonst muss jede von ihnen angefasst
 * werden, sobald ein Kanal dazukommt oder wegfällt, und irgendwann wird eine
 * davon vergessen.
 *
 * JEDER KANAL SCHEITERT FÜR SICH
 * -------------------------------
 * Die Wege laufen nebeneinander und werden einzeln abgefangen. Ein defektes
 * Telegram-Token darf den WhatsApp-Versand nicht mitreißen, und keiner von
 * beiden darf eine bereits gespeicherte Buchung zu einem Fehler für die
 * Kundschaft machen.
 *
 * IST NICHTS EINGERICHTET, PASSIERT NICHTS. Kein Fehler, keine Verzögerung —
 * nur ein Hinweis im Serverprotokoll.
 */

import { protokollFehler, protokollHinweis } from "./serverLog";

export type NotifyChannel = "telegram" | "whatsapp";

export type NotifyOutcome = {
  channel: NotifyChannel;
  sent: boolean;
  reason?: string;
};

export type OwnerNotifyStatus = {
  /** Mindestens ein Weg ist eingerichtet. */
  any: boolean;
  telegram: boolean;
  whatsapp: boolean;
  /** Zielnummer für WhatsApp, gekürzt — nur zur Anzeige. */
  whatsappTo: string | null;
  /** WhatsApp ohne Vorlage kann außerhalb von 24 Stunden nicht senden. */
  whatsappTemplateSet: boolean;
};

export async function ownerNotifyStatus(): Promise<OwnerNotifyStatus> {
  const { telegramConfigured } = await import("./telegram.server");
  const { whatsappSettingsSummary } = await import("./whatsapp.server");

  const telegram = telegramConfigured();
  const whats = whatsappSettingsSummary();

  return {
    any: telegram || whats.configured,
    telegram,
    whatsapp: whats.configured,
    whatsappTo: whats.to,
    whatsappTemplateSet: whats.templateSet,
  };
}

/**
 * Meldung über alle eingerichteten Wege verschicken.
 *
 * Wirft nie. Der Aufrufer bekommt das Ergebnis je Kanal zurück und kann es
 * auswerten — oder ignorieren, wie es die Buchungsstrecke tut.
 */
export async function notifyOwner(text: string, anlass: string): Promise<NotifyOutcome[]> {
  const status = await ownerNotifyStatus();

  if (!status.any) {
    protokollHinweis("benachrichtigung", "Kein Weg eingerichtet — nichts verschickt", { anlass });
    return [];
  }

  const aufgaben: Promise<NotifyOutcome>[] = [];

  if (status.telegram) {
    aufgaben.push(
      import("./telegram.server")
        .then((m) => m.sendTelegram(text))
        .then((r) => ({ channel: "telegram" as const, ...r }))
        .catch((error: unknown) => ({
          channel: "telegram" as const,
          sent: false,
          reason: error instanceof Error ? error.message : String(error),
        })),
    );
  }

  if (status.whatsapp) {
    aufgaben.push(
      import("./whatsapp.server")
        .then((m) => m.sendWhatsApp(text))
        .then((r) => ({ channel: "whatsapp" as const, ...r }))
        .catch((error: unknown) => ({
          channel: "whatsapp" as const,
          sent: false,
          reason: error instanceof Error ? error.message : String(error),
        })),
    );
  }

  const ergebnisse = await Promise.all(aufgaben);

  for (const e of ergebnisse) {
    if (!e.sent) {
      // Der Grund stammt aus der Antwort von Telegram beziehungsweise Meta
      // und kann die Zielnummer enthalten — deshalb über die redigierende
      // Ablage statt direkt auf die Konsole.
      protokollFehler("benachrichtigung", "Meldung fehlgeschlagen", e.reason, {
        kanal: e.channel,
        anlass,
      });
    }
  }

  return ergebnisse;
}
