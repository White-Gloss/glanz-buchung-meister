import { createHash } from "node:crypto";
import { z } from "zod";
import { site } from "../data/site.ts";
import type { Sql } from "./db.ts";
import { enqueueNotification } from "./booking-notifications.ts";
import { ownerNotifyTargets } from "./ops.ts";
import { isEmailAddress } from "./utils.ts";
import {
  isWithdrawalCustomerMessage,
  WITHDRAWAL_OWNER,
  WITHDRAWAL_RECEIVED,
} from "./withdrawal-policy.ts";

/**
 * Elektronische Widerrufsfunktion nach § 356a BGB (seit 19.06.2026).
 *
 * Der Verbraucher gibt Name, Vertrag und eine E-Mail-Adresse für die
 * Eingangsbestätigung an und bestätigt mit „Widerruf bestätigen“. Der Widerruf
 * wird ohne neue Tabelle dauerhaft im bestehenden Ausgang gespeichert: eine
 * Eingangsbestätigung an den Verbraucher (dauerhafter Datenträger) und eine
 * Meldung an den Inhaber. Ein Grund wird bewusst nicht abgefragt.
 */
export const WITHDRAWAL_PATH = "/vertrag-widerrufen";
export { isWithdrawalCustomerMessage, WITHDRAWAL_OWNER, WITHDRAWAL_RECEIVED };

export const withdrawalSchema = z
  .object({
    requestId: z.string().uuid(),
    name: z.string().trim().min(2, "Bitte Ihren Namen angeben.").max(120),
    contract: z
      .string()
      .trim()
      .min(3, "Bitte den Vertrag bezeichnen, z. B. mit Vorgangsnummer oder Leistung und Datum.")
      .max(500),
    scope: z.enum(["gesamt", "teil"]),
    part: z.string().trim().max(500).optional(),
    email: z
      .string()
      .trim()
      .max(160)
      .refine((value) => isEmailAddress(value), "Bitte eine gültige E-Mail-Adresse angeben."),
    website: z.string().max(120).optional(),
  })
  .refine((value) => value.scope === "gesamt" || (value.part?.trim().length ?? 0) >= 3, {
    message: "Bitte angeben, welchen Teil des Vertrags Sie widerrufen.",
    path: ["part"],
  });

export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

export type WithdrawalReceipt = {
  reference: string;
  receivedAt: string;
  receivedAtLabel: string;
  /** Die gespeicherte Erklärung – bei Wiederholungen die ursprüngliche, nie das neue Formular. */
  declaration: string[];
  email: string;
  duplicate: boolean;
};

export function withdrawalReference(requestId: string): string {
  return `WR-${createHash("sha256").update(`withdrawal:${requestId}`).digest("hex").slice(0, 10).toUpperCase()}`;
}

export function formatReceivedAt(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  })
    .format(date)
    .replace(",", " um");
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Inhalt der Widerrufserklärung, wie er dem Verbraucher bestätigt wird. */
export function withdrawalDeclaration(input: WithdrawalInput): string[] {
  const scope =
    input.scope === "gesamt"
      ? "den gesamten Vertrag"
      : `folgenden Teil des Vertrags: ${oneLine(input.part ?? "")}`;
  return [
    `Hiermit widerrufe ich ${scope}.`,
    `Name: ${oneLine(input.name)}`,
    `Vertrag: ${oneLine(input.contract)}`,
    `E-Mail für die Eingangsbestätigung: ${input.email.trim()}`,
  ];
}

const RECEIVED_LINE = "Eingang der Widerrufserklärung: ";
const DECLARATION_HEADING = "Inhalt Ihrer Widerrufserklärung:";

export function withdrawalMessages(input: WithdrawalInput, reference: string, receivedAt: Date) {
  const received = formatReceivedAt(receivedAt);
  const declaration = withdrawalDeclaration(input);
  const provider = `${site.ownerLegalName} · ${site.legalName} · ${site.street} · ${site.postalCode} ${site.city}`;
  const customer = {
    subject: `Eingangsbestätigung Ihres Widerrufs ${reference} · ${site.legalName}`,
    body: [
      `Guten Tag ${oneLine(input.name)},`,
      "",
      `wir bestätigen den Eingang Ihrer Widerrufserklärung, die Sie über die Widerrufsfunktion auf ${new URL(site.origin).host} abgegeben haben.`,
      "",
      `${RECEIVED_LINE}${received}`,
      `Referenz: ${reference}`,
      "",
      DECLARATION_HEADING,
      ...declaration.map((line) => `  ${line}`),
      "",
      "Diese Nachricht bestätigt den Eingang Ihrer Erklärung. Die Folgen des Widerrufs, insbesondere die Rückzahlung, richten sich nach unserer Widerrufsbelehrung:",
      `${site.origin}/widerruf`,
      "",
      `Bei Fragen erreichen Sie uns unter ${site.email} oder telefonisch unter ${site.phoneDisplay}.`,
      "",
      "Mit freundlichen Grüßen",
      site.ownerLegalName,
      provider,
    ].join("\n"),
  };
  const owner = {
    subject: `Widerruf eingegangen: ${reference} · ${oneLine(input.name)}`,
    body: [
      "Über die Widerrufsfunktion der Website ist ein Widerruf eingegangen.",
      "",
      `${RECEIVED_LINE}${received}`,
      `Referenz: ${reference}`,
      "",
      ...declaration,
      "",
      "Die Eingangsbestätigung an den Kunden wurde automatisch in den Versand gegeben.",
      "Bitte Vertrag zuordnen, Termin bei Bedarf absagen und erhaltene Zahlungen spätestens 14 Tage nach Eingang erstatten (Wertersatz für bereits erbrachte Leistungen nur, wenn der Kunde den vorzeitigen Beginn ausdrücklich verlangt hat).",
    ].join("\n"),
  };
  return { customer, owner, received };
}

function receivedLabelFromBody(body: string | null | undefined): string | null {
  const line = body?.split("\n").find((entry) => entry.startsWith(RECEIVED_LINE));
  return line ? line.slice(RECEIVED_LINE.length) : null;
}

function declarationFromBody(body: string | null | undefined): string[] {
  const lines = body?.split("\n") ?? [];
  const start = lines.indexOf(DECLARATION_HEADING);
  if (start < 0) return [];
  const declaration: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    declaration.push(line.slice(2));
  }
  return declaration;
}

/**
 * Speichert den Widerruf dauerhaft im Ausgang. Wiederholte Übermittlungen
 * derselben Formularkennung erzeugen keine zweite Erklärung und keine zweite
 * Bestätigung; zurückgegeben wird der ursprüngliche Eingangszeitpunkt.
 */
export async function queueWithdrawal(
  sql: Sql,
  input: WithdrawalInput,
  now = new Date(),
): Promise<WithdrawalReceipt> {
  const reference = withdrawalReference(input.requestId);
  const messages = withdrawalMessages(input, reference, now);
  const owner = ownerNotifyTargets();
  const customerKey = `withdrawal:${reference}:customer:email`;
  let created = false;
  await sql.transaction(async (tx) => {
    const id = await enqueueNotification(tx, {
      key: customerKey,
      eventType: WITHDRAWAL_RECEIVED,
      channel: "email",
      to: input.email.trim(),
      subject: messages.customer.subject,
      body: messages.customer.body,
    });
    if (id === null) return;
    created = true;
    if (owner.email) {
      await enqueueNotification(tx, {
        key: `withdrawal:${reference}:owner:email`,
        eventType: WITHDRAWAL_OWNER,
        channel: "email",
        to: owner.email,
        subject: messages.owner.subject,
        body: messages.owner.body,
      });
    }
    if (owner.whatsapp) {
      await enqueueNotification(tx, {
        key: `withdrawal:${reference}:owner:whatsapp`,
        eventType: WITHDRAWAL_OWNER,
        channel: "whatsapp",
        to: owner.whatsapp,
        subject: messages.owner.subject,
        body: messages.owner.body,
      });
    }
    await tx`
      insert into automation_events(shop_id, area, event, severity, context)
      values ('white-gloss', 'widerruf', 'eingegangen', 'warning', ${`${reference} · Eingang ${messages.received}`})
    `;
  });
  if (created) {
    return {
      reference,
      receivedAt: now.toISOString(),
      receivedAtLabel: messages.received,
      declaration: withdrawalDeclaration(input),
      email: input.email.trim(),
      duplicate: false,
    };
  }
  const [existing] = await sql<{ body: string; to_addr: string | null; created_at: string | Date }>`
    select body, to_addr, created_at from outbound_queue
    where shop_id = 'white-gloss' and event_key = ${customerKey}
  `;
  if (!existing) throw new Error("Widerruf konnte nicht gelesen werden.");
  const createdAt = new Date(existing.created_at);
  return {
    reference,
    receivedAt: createdAt.toISOString(),
    receivedAtLabel: receivedLabelFromBody(existing.body) ?? formatReceivedAt(createdAt),
    declaration: declarationFromBody(existing.body),
    email: existing.to_addr ?? "",
    duplicate: true,
  };
}
