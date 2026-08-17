/**
 * TELEGRAM-BENACHRICHTIGUNG AN DEN BETRIEB (serverseitig)
 * =======================================================
 * Der einfache Weg, sofort eine Meldung aufs Handy zu bekommen: kein
 * Genehmigungsverfahren, keine Nachrichtenvorlagen, keine Kosten. Ein Bot
 * schreibt in einen Chat, fertig.
 *
 * ZWEI EIGENHEITEN VON TELEGRAM, DIE MAN KENNEN MUSS:
 *
 * 1. Ein Bot kann kein Gespräch beginnen. Der Betrieb muss dem Bot einmal
 *    selbst schreiben, sonst weist Telegram jeden Versand mit „chat not
 *    found" ab. Deshalb steht dieser Schritt in der Anleitung ganz vorn.
 * 2. Die Chat-Kennung ist keine Telefonnummer, sondern eine Zahl. Bei
 *    Gruppen ist sie negativ — das ist normal und kein Vorzeichenfehler.
 *
 * Das Bot-Token ist ein Passwort: Wer es hat, kann als dieser Bot schreiben
 * und mitlesen. Es gehört ausschließlich in die geschützten
 * Umgebungsvariablen des Servers, niemals in eine Datei mit `VITE_`-Präfix
 * und niemals in `servicesConfig.ts`, weil die im Browser landet.
 */

const TIMEOUT_MS = 10_000;

export type TelegramConfig = { botToken: string; chatId: string };

function config(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

export function telegramConfigured(): boolean {
  return config() !== null;
}

export type TelegramResult = { sent: boolean; reason?: string };

/**
 * Telegram-Fehler sind technisch formuliert. Die häufigsten werden hier in
 * Sätze übersetzt, die sagen, was zu tun ist.
 */
function lesbarerFehler(status: number, rohtext: string): string {
  if (/chat not found/i.test(rohtext)) {
    return "Chat nicht gefunden. Schreiben Sie dem Bot einmal selbst (/start) und prüfen Sie die Chat-Kennung.";
  }
  if (/bot was blocked/i.test(rohtext)) {
    return "Der Bot wurde blockiert. In Telegram den Chat öffnen und die Blockierung aufheben.";
  }
  if (status === 401) {
    return "Das Bot-Token wird abgelehnt. Bitte den Wert aus BotFather erneut übernehmen.";
  }
  return `Telegram antwortete ${status}: ${rohtext.slice(0, 200)}`;
}

async function senden(text: string): Promise<TelegramResult> {
  const c = config();
  if (!c) return { sent: false, reason: "nicht eingerichtet" };

  try {
    const antwort = await fetch(`https://api.telegram.org/bot${c.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: c.chatId,
        text,
        // Kein parse_mode: Kundennamen können Zeichen enthalten, die
        // Telegram sonst als Formatierung liest und die Nachricht abweisen
        // lassen. Reiner Text ist hier zuverlässiger als hübsch.
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!antwort.ok) {
      return { sent: false, reason: lesbarerFehler(antwort.status, await antwort.text()) };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendTelegram(text: string): Promise<TelegramResult> {
  return senden(text);
}

export async function sendTelegramSelfTest(): Promise<TelegramResult> {
  return senden(
    "Test von white-gloss.de — die Benachrichtigung steht. Ab jetzt kommt hier eine Nachricht, sobald eine Anfrage eingeht.",
  );
}
