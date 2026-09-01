import { bookingStatuses, type BookingStatus } from "@/data/site";

export type AgentAction =
  | { type: "help" }
  | { type: "list-today" }
  | { type: "list-inbox" }
  | { type: "status"; id: number; status: BookingStatus }
  | { type: "customer"; query: string }
  | { type: "invoice"; id: number }
  | { type: "remind" }
  | { type: "unknown"; raw: string };

const statusAlias: Record<string, BookingStatus> = {
  neu: "neu",
  neuigkeit: "neu",
  bestaetigt: "bestaetigt",
  bestätigt: "bestaetigt",
  bestaetigen: "bestaetigt",
  bestätigen: "bestaetigt",
  zusage: "bestaetigt",
  ok: "bestaetigt",
  confirm: "bestaetigt",
  abgelehnt: "abgelehnt",
  ablehnen: "abgelehnt",
  stornieren: "abgelehnt",
  cancel: "abgelehnt",
  erledigt: "erledigt",
  fertig: "erledigt",
  done: "erledigt",
};

function bookingId(text: string): number | null {
  const match = /(?:wg[-\s]?)?(\d{1,6})/i.exec(text);
  return match ? Number(match[1]) : null;
}

export function parseAgentCommand(raw: string): AgentAction {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { type: "help" };
  const lower = text.toLowerCase();

  if (/^(hilfe|help|befehle|\?)$/.test(lower)) return { type: "help" };
  if (/(termine|heute|kalender|agenda|was steht an)/.test(lower) && !/\d/.test(lower)) {
    return { type: "list-today" };
  }
  if (
    /(posteingang|inbox|mails|anfragen|ungelesen)/.test(lower) &&
    !/\d/.test(lower)
  ) {
    return { type: "list-inbox" };
  }
  if (lower === "post") return { type: "list-inbox" };
  if (/(erinnerung|remind|mahnen)/.test(lower) && !/\d/.test(lower)) {
    return { type: "remind" };
  }

  const confirm = /(?:bestätig\w*|bestaetig\w*|zusage|zusagen)/i.test(text);
  const reject = /(?:ablehn\w*|stornier\w*|cancel)/i.test(text);
  const done = /(?:erledigt|fertig|abgeschlossen)/i.test(text);
  const id = bookingId(text);

  if (id && confirm) return { type: "status", id, status: "bestaetigt" };
  if (id && reject) return { type: "status", id, status: "abgelehnt" };
  if (id && done) return { type: "status", id, status: "erledigt" };

  const statusMatch =
    /(?:status|buchung|auftrag)\s*#?\s*(\d+)\s+(\S+)/i.exec(text) ||
    /(?:wg-)?(\d+)\s+(bestaetigt|bestätigt|abgelehnt|erledigt|neu|fertig|ok)\b/i.exec(text);
  if (statusMatch) {
    const status = statusAlias[statusMatch[2].toLowerCase()];
    if (status) return { type: "status", id: Number(statusMatch[1]), status };
  }

  const invoiceMatch = /(?:rechnung|angebot|beleg)\s*(?:für\s*)?(?:wg-?)?#?\s*(\d+)/i.exec(text);
  if (invoiceMatch) return { type: "invoice", id: Number(invoiceMatch[1]) };

  const customerMatch = /(?:kunde|kunden|suche)\s+(.+)/i.exec(text);
  if (customerMatch) return { type: "customer", query: customerMatch[1].trim() };

  return { type: "unknown", raw: text };
}

export function agentHelpText() {
  const statuses = bookingStatuses.map((s) => s.id).join(" | ");
  return [
    "Befehle für WhatsApp, Telegram und das Betriebspanel:",
    `status 12 ${statuses}`,
    "bestätige 12   ·  ablehnen 12  ·  erledigt 12",
    "termine        – offene und heutige Buchungen",
    "post           – ungelesene Anfragen",
    "erinnerung     – Termine in den nächsten 24 Stunden",
    "kunde Müller",
    "rechnung 12",
    "hilfe",
  ].join("\n");
}
