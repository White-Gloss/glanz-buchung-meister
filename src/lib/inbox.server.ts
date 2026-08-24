import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * POSTEINGANG (serverseitig)
 * ---------------------------
 * Liest das bestehende IONOS-Postfach über IMAP und zeigt die Nachrichten im
 * Adminbereich an. Das Postfach selbst bleibt unverändert — Outlook, Handy und
 * Webmail funktionieren weiter wie bisher.
 *
 * DREI ENTSCHEIDUNGEN, DIE BEWUSST SO GETROFFEN SIND:
 *
 * 1. NUR LESEN. Die Verbindung öffnet das Postfach ausdrücklich schreibgeschützt
 *    (`readOnly`). Dadurch wird beim Anzeigen nichts als gelesen markiert und
 *    nichts verschoben oder gelöscht. Sonst verschwände im Outlook der
 *    Ungelesen-Hinweis, sobald jemand hier hineinschaut.
 *
 * 2. NICHTS WIRD GESPEICHERT. Die Nachrichten werden bei jedem Aufruf frisch
 *    geholt und danach verworfen. Eine Kopie in der Datenbank wäre ein zweiter
 *    Ort, an dem Kundenkorrespondenz liegt — mit eigener Aufbewahrungsfrist,
 *    eigenem Löschkonzept und eigenem Risiko. Das Postfach bleibt die eine
 *    Quelle.
 *
 * 3. KEINE ANHÄNGE. Es werden nur Namen und Größen angezeigt. Ein Anhang aus
 *    einer fremden Mail, den die Website ausliefert, wäre ein Einfallstor —
 *    Anhänge öffnet man weiterhin im Mailprogramm.
 *
 * ZUGANGSDATEN gehören ausschließlich in die geschützten Umgebungsvariablen des
 * Servers, niemals ins Repository und niemals mit `VITE_`-Präfix.
 */

const VERBINDUNGS_TIMEOUT_MS = 15_000;

export type InboxConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
};

function config(): InboxConfig | null {
  const host = process.env.IMAP_HOST;
  const user = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;
  if (!host || !user || !password) return null;

  // IONOS nutzt 993 mit direkter Verschlüsselung. Port 143 (STARTTLS) wird
  // unterstützt, ist aber nicht die Voreinstellung.
  // Einmal auf den tatsaechlich verwendeten Port festlegen. Bei einem
  // Schreibfehler in IMAP_PORT stuende hier sonst NaN: der Port fiele auf 993
  // zurueck, die daraus abgeleitete Verschluesselung aber auf "aus" — die
  // Verbindung liefe dann unverschluesselt gegen den TLS-Port.
  const angegebenerPort = Number(process.env.IMAP_PORT ?? 993);
  const port = Number.isFinite(angegebenerPort) ? angegebenerPort : 993;
  return {
    host,
    port,
    user,
    password,
    secure: process.env.IMAP_SECURE ? process.env.IMAP_SECURE === "true" : port === 993,
  };
}

export function inboxConfigured(): boolean {
  return config() !== null;
}

/** Zustand für die Anzeige im Adminbereich — ohne das Passwort. */
export function inboxSettingsSummary(): {
  configured: boolean;
  host: string | null;
  user: string | null;
} {
  const c = config();
  return { configured: c !== null, host: c?.host ?? null, user: c?.user ?? null };
}

export type InboxMessage = {
  uid: number;
  /** Absender, so wie er in der Mail steht. */
  from: string;
  subject: string;
  /** ISO-Zeitstempel des Versands. */
  date: string;
  /** Ist die Nachricht im Postfach als gelesen markiert? */
  seen: boolean;
  /** Anhänge nur dem Namen nach. */
  attachments: { filename: string; sizeBytes: number }[];
  /** Reiner Text der Nachricht, gekürzt. */
  text: string;
};

async function mitVerbindung<T>(
  arbeit: (client: ImapFlow, postfach: string) => Promise<T>,
): Promise<T> {
  const c = config();
  if (!c) throw new Error("Der Posteingang ist nicht eingerichtet.");

  const client = new ImapFlow({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.password },
    // Das Protokoll der Bibliothek würde sonst jede einzelne IMAP-Zeile
    // ausgeben — darunter Betreffzeilen und Absender aus fremder Post.
    logger: false,
    greetingTimeout: VERBINDUNGS_TIMEOUT_MS,
    socketTimeout: VERBINDUNGS_TIMEOUT_MS * 4,
  });

  await client.connect();
  try {
    // readOnly: Ansehen darf den Zustand des Postfachs nicht verändern.
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      return await arbeit(client, "INBOX");
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/** Absenderzeile lesbar machen: „Name <adresse>" oder nur die Adresse. */
function absender(value: unknown): string {
  if (!value || typeof value !== "object") return "(unbekannt)";
  const adressen = (value as { value?: { name?: string; address?: string }[] }).value ?? [];
  const erste = adressen[0];
  if (!erste) return "(unbekannt)";
  if (erste.name && erste.address) return `${erste.name} <${erste.address}>`;
  return erste.address ?? erste.name ?? "(unbekannt)";
}

/**
 * Die neuesten Nachrichten holen.
 *
 * `limit` bleibt bewusst klein: Jede Nachricht wird vollständig geladen und
 * geparst, und ein Postfach mit Jahren an Post würde die Anfrage sonst
 * minutenlang blockieren.
 */
export async function listInbox(limit = 25): Promise<InboxMessage[]> {
  const grenze = Math.min(Math.max(1, Math.floor(limit)), 50);

  return mitVerbindung(async (client) => {
    const status = await client.status("INBOX", { messages: true });
    const gesamt = status.messages ?? 0;
    if (gesamt === 0) return [];

    // Die letzten n Nachrichten nach Nachrichtennummer — das ist die
    // zuverlässigste Art, „die neuesten" zu bekommen, ohne das ganze
    // Postfach zu durchsuchen.
    const von = Math.max(1, gesamt - grenze + 1);
    const bereich = `${von}:${gesamt}`;

    const nachrichten: InboxMessage[] = [];
    for await (const nachricht of client.fetch(bereich, {
      uid: true,
      flags: true,
      source: true,
    })) {
      if (!nachricht.source) continue;
      const geparst = await simpleParser(nachricht.source);

      const text = (geparst.text ?? "").replace(/\r\n/g, "\n").trim();

      nachrichten.push({
        uid: nachricht.uid,
        from: absender(geparst.from),
        subject: geparst.subject?.trim() || "(kein Betreff)",
        date: (geparst.date ?? new Date()).toISOString(),
        seen: nachricht.flags?.has("\\Seen") ?? false,
        attachments: (geparst.attachments ?? []).map((a) => ({
          filename: a.filename ?? "(ohne Namen)",
          sizeBytes: a.size ?? 0,
        })),
        // Begrenzt, damit eine einzelne Werbemail die Antwort nicht aufbläht.
        text: text.length > 8000 ? `${text.slice(0, 8000)}\n\n[…gekürzt]` : text,
      });
    }

    // Neueste zuerst.
    return nachrichten.reverse();
  });
}

/** Verbindungstest für den Adminbereich — ohne Nachrichteninhalte. */
export async function testInbox(): Promise<{ ok: true; messages: number }> {
  return mitVerbindung(async (client) => {
    const status = await client.status("INBOX", { messages: true, unseen: true });
    return { ok: true, messages: status.messages ?? 0 };
  });
}
