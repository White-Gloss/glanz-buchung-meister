import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { getSql } from "@/lib/db";
import { agentHelpText, parseAgentCommand } from "@/lib/agent";
import { packages } from "@/data/site";
import { buildCalendarIcs } from "@/lib/calendar-ics";
import { OUTBOUND_QUEUED, flushOutboundEmailQueue, queueBookingAutomation } from "@/lib/ops";
import { requireOperator } from "@/lib/operator";
import { assertPublicPostLimit } from "@/lib/rate-limit";
import { isEmailAddress } from "@/lib/utils";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";

const SHOP = "white-gloss";
const DEFAULT_OPERATOR_PIN = "WG-BETRIEB";

async function ensureShopSettings(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    create table if not exists shop_settings (
      shop_id text primary key default 'white-gloss',
      operator_pin text not null default 'WG-BETRIEB',
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    insert into shop_settings (shop_id, operator_pin)
    values (${SHOP}, ${"WG-BETRIEB"})
    on conflict (shop_id) do nothing
  `;
}

export type InboxRow = {
  id: number;
  channel: string;
  direction: string;
  sender: string | null;
  subject: string | null;
  body: string;
  booking_id: number | null;
  read_at: string | null;
  created_at: string;
};

export type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  booking_count: number;
};

export type DocumentRow = {
  id: number;
  booking_id: number | null;
  customer_id: number | null;
  kind: string;
  title: string;
  amount_cents: number;
  status: string;
  body: string;
  created_at: string;
};

export type AgentLogRow = {
  id: number;
  channel: string;
  input: string;
  result: string;
  created_at: string;
};

export const getOperatorAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      await requireOperator(context.userId);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const listInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return sql<InboxRow>`
      select id, channel, direction, sender, subject, body, booking_id, read_at, created_at
      from inbox_messages
      where shop_id = ${SHOP}
      order by created_at desc
      limit 200
    `;
  });

export const markInboxRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update inbox_messages set read_at = now()
      where id = ${data.id} and shop_id = ${SHOP}
    `;
    return { ok: true as const };
  });

export const replyInbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        id: z.number().int().positive(),
        body: z.string().trim().min(2).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const source = await sql<InboxRow>`
      select id, channel, direction, sender, subject, body, booking_id, read_at, created_at
      from inbox_messages
      where id = ${data.id} and shop_id = ${SHOP}
      limit 1
    `;
    const original = source[0];
    if (!original) throw new Error("Nachricht nicht gefunden.");
    const subject = original.subject?.startsWith("Re:")
      ? original.subject
      : `Re: ${original.subject ?? "Anfrage"}`;
    await sql`
      insert into inbox_messages (shop_id, channel, direction, sender, subject, body, booking_id, read_at)
      values (
        ${SHOP}, ${original.channel}, ${"out"}, ${"White Gloss"}, ${subject},
        ${data.body}, ${original.booking_id}, now()
      )
    `;
    let toAddr: string | null = null;
    if (original.booking_id) {
      const [booking] = await sql<{ email: string | null; phone: string }>`
        select email, phone from bookings
        where id = ${original.booking_id} and shop_id = ${SHOP}
        limit 1
      `;
      if (original.channel === "whatsapp") toAddr = booking?.phone ?? null;
      else if (isEmailAddress(booking?.email)) toAddr = booking!.email;
    }
    if (!toAddr && isEmailAddress(original.sender)) toAddr = original.sender;
    if (toAddr && !(original.channel === "email" && !isEmailAddress(toAddr))) {
      const channel = original.channel === "form" ? "email" : original.channel;
      const outboundChannel = channel === "telegram" || channel === "whatsapp" ? channel : "email";
      if (outboundChannel !== "email" || isEmailAddress(toAddr)) {
        await sql`
          insert into outbound_queue (shop_id, channel, to_addr, subject, body, booking_id, status)
          values (
            ${SHOP}, ${outboundChannel},
            ${toAddr}, ${subject}, ${data.body}, ${original.booking_id}, ${OUTBOUND_QUEUED}
          )
        `;
      }
    }
    await sql`
      update inbox_messages set read_at = now()
      where id = ${original.id} and shop_id = ${SHOP}
    `;
    await sql`
      insert into automation_events (shop_id, area, event, severity, context)
      values (${SHOP}, ${"mail"}, ${"antwort"}, ${"info"}, ${subject})
    `;
    return { ok: true as const };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return sql<CustomerRow>`
      select c.id, c.name, c.phone, c.email, c.notes, c.created_at,
             coalesce(b.cnt, 0)::int as booking_count
      from customers c
      left join (
        select phone, count(*)::int as cnt
        from bookings
        where shop_id = ${SHOP}
        group by phone
      ) b on b.phone = c.phone
      where c.shop_id = ${SHOP}
      order by c.created_at desc
      limit 200
    `;
  });

export const updateCustomerNotes = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ id: z.number().int().positive(), notes: z.string().max(4000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update customers set notes = ${data.notes}
      where id = ${data.id} and shop_id = ${SHOP}
    `;
    return { ok: true as const };
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return sql<DocumentRow>`
      select id, booking_id, customer_id, kind, title, amount_cents, status, body, created_at
      from documents
      where shop_id = ${SHOP}
      order by created_at desc
      limit 200
    `;
  });

export const createDocumentFromBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        bookingId: z.number().int().positive(),
        kind: z.enum(["angebot", "rechnung", "erinnerung"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const bookings = await sql<{
      id: number;
      customer_name: string;
      package_id: string;
      total_cents: number;
    }>`
      select id, customer_name, package_id, total_cents
      from bookings
      where id = ${data.bookingId} and shop_id = ${SHOP}
      limit 1
    `;
    const booking = bookings[0];
    if (!booking) throw new Error("Buchung nicht gefunden.");
    const pack = packages.find((p) => p.id === booking.package_id);
    const kindLabel =
      data.kind === "angebot" ? "Angebot" : data.kind === "rechnung" ? "Rechnung" : "Zahlungserinnerung";
    const title = `${kindLabel} ${pack?.name ?? booking.package_id} · ${booking.customer_name}`;
    const body = [
      `${kindLabel} für ${booking.customer_name}`,
      `Leistung: ${pack?.name ?? booking.package_id}`,
      `Betrag brutto: ${(booking.total_cents / 100).toFixed(2)} EUR inkl. 19 % MwSt.`,
      data.kind === "rechnung"
        ? "Kein Steuerbeleg dieser Vorschau – verbindliche Rechnung stellt die Buchhaltung (Lexware) aus."
        : "Unverbindlich. Vertrag erst nach Bestätigung.",
    ].join("\n");
    const rows = await sql<{ id: number }>`
      insert into documents (shop_id, booking_id, kind, title, amount_cents, status, body, created_by)
      values (
        ${SHOP}, ${booking.id}, ${data.kind}, ${title}, ${booking.total_cents},
        ${"entwurf"}, ${body}, ${context.userId}
      )
      returning id
    `;
    return { id: rows[0]?.id, title };
  });

export const updateDocumentStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        id: z.number().int().positive(),
        status: z.enum(["entwurf", "gesendet", "bezahlt"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update documents set status = ${data.status}
      where id = ${data.id} and shop_id = ${SHOP}
    `;
    return { ok: true as const };
  });

export const accountingSummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const [booked] = await sql<{ n: number; sum: number }>`
      select count(*)::int as n, coalesce(sum(total_cents), 0)::int as sum
      from bookings
      where shop_id = ${SHOP} and status in ('bestaetigt', 'erledigt')
    `;
    const [open] = await sql<{ n: number; sum: number }>`
      select count(*)::int as n, coalesce(sum(amount_cents), 0)::int as sum
      from documents
      where shop_id = ${SHOP} and kind = 'rechnung' and status <> 'bezahlt'
    `;
    const [paid] = await sql<{ n: number; sum: number }>`
      select count(*)::int as n, coalesce(sum(amount_cents), 0)::int as sum
      from documents
      where shop_id = ${SHOP} and kind = 'rechnung' and status = 'bezahlt'
    `;
    return {
      confirmedCount: booked?.n ?? 0,
      confirmedCents: booked?.sum ?? 0,
      openInvoiceCount: open?.n ?? 0,
      openInvoiceCents: open?.sum ?? 0,
      paidInvoiceCount: paid?.n ?? 0,
      paidInvoiceCents: paid?.sum ?? 0,
      vatRate: 0.19,
      erpConnected: false,
      lexwareConnected: false,
    };
  });

export const listAgentLog = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return sql<AgentLogRow>`
      select id, channel, input, result, created_at
      from agent_commands
      where shop_id = ${SHOP}
      order by created_at desc
      limit 50
    `;
  });

async function executeParsed(
  sql: Awaited<ReturnType<typeof getSql>>,
  action: ReturnType<typeof parseAgentCommand>,
  userId: string,
): Promise<string> {
  if (action.type === "help") return agentHelpText();

  if (action.type === "list-today") {
    const rows = await sql<{
      id: number;
      customer_name: string;
      status: string;
      preferred_date: string | null;
      preferred_slot: string | null;
      package_id: string;
    }>`
      select id, customer_name, status, preferred_date, preferred_slot, package_id
      from bookings
      where shop_id = ${SHOP}
        and status in ('neu', 'bestaetigt')
      order by preferred_date nulls last, id desc
      limit 12
    `;
    if (rows.length === 0) return "Keine offenen Buchungen.";
    return rows
      .map(
        (r) =>
          `#${r.id} ${r.customer_name} · ${r.package_id} · ${r.status}` +
          (r.preferred_date ? ` · ${r.preferred_date} ${r.preferred_slot ?? ""}` : ""),
      )
      .join("\n");
  }

  if (action.type === "list-inbox") {
    const rows = await sql<{ id: number; subject: string | null; sender: string | null }>`
      select id, subject, sender from inbox_messages
      where shop_id = ${SHOP} and read_at is null
      order by created_at desc
      limit 8
    `;
    if (rows.length === 0) return "Posteingang leer.";
    return rows.map((r) => `#${r.id} ${r.sender ?? "?"} · ${r.subject ?? ""}`).join("\n");
  }

  if (action.type === "status") {
    const updated = await sql<{
      id: number;
      customer_name: string;
      email: string | null;
      phone: string;
      package_id: string;
      preferred_date: string | null;
      preferred_slot: string | null;
    }>`
      update bookings
      set status = ${action.status}, handled_by = ${userId}, updated_at = now()
      where id = ${action.id} and shop_id = ${SHOP}
      returning id, customer_name, email, phone, package_id, preferred_date, preferred_slot
    `;
    if (!updated[0]) return `Buchung #${action.id} nicht gefunden.`;
    await queueBookingAutomation(sql, updated[0], action.status, userId);
    return `Buchung #${updated[0].id} (${updated[0].customer_name}) ist jetzt ${action.status}.`;
  }

  if (action.type === "customer") {
    const q = `%${action.query}%`;
    const rows = await sql<{ id: number; name: string; phone: string }>`
      select id, name, phone from customers
      where shop_id = ${SHOP} and (name ilike ${q} or phone ilike ${q})
      limit 8
    `;
    if (rows.length === 0) return `Kein Kunde zu „${action.query}“.`;
    return rows.map((r) => `#${r.id} ${r.name} · ${r.phone}`).join("\n");
  }

  if (action.type === "invoice") {
    const bookings = await sql<{
      id: number;
      customer_name: string;
      package_id: string;
      total_cents: number;
    }>`
      select id, customer_name, package_id, total_cents
      from bookings where id = ${action.id} and shop_id = ${SHOP} limit 1
    `;
    const booking = bookings[0];
    if (!booking) return `Buchung #${action.id} nicht gefunden.`;
    const title = `Rechnung ${booking.package_id} · ${booking.customer_name}`;
    const body = `Rechnung für ${booking.customer_name}, ${(booking.total_cents / 100).toFixed(2)} EUR brutto.`;
    const doc = await sql<{ id: number }>`
      insert into documents (shop_id, booking_id, kind, title, amount_cents, status, body, created_by)
      values (${SHOP}, ${booking.id}, ${"rechnung"}, ${title}, ${booking.total_cents}, ${"entwurf"}, ${body}, ${userId})
      returning id
    `;
    return `Rechnung-Entwurf #${doc[0]?.id} angelegt (${title}).`;
  }

  if (action.type === "remind") {
    return runReminderPass(sql, userId);
  }

  return "";
}

async function interpretWithGrok(text: string): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content:
            "Du steuerst das White-Gloss-Admin. Antworte NUR mit einer Zeile in genau einem dieser Formate: status <id> <neu|bestaetigt|abgelehnt|erledigt> | termine | post | kunde <name> | rechnung <id> | erinnerung | hilfe. Keine Erklärungen.",
        },
        { role: "user", content: text.slice(0, 400) },
      ],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() ?? null;
}

export const runAgentCommand = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        text: z.string().min(1).max(500),
        channel: z.enum(["panel", "whatsapp", "telegram"]).default("panel"),
        useAi: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    let parsed = parseAgentCommand(data.text);
    if (parsed.type === "unknown" && data.useAi) {
      const interpreted = await interpretWithGrok(data.text);
      if (interpreted) parsed = parseAgentCommand(interpreted);
    }
    let result = await executeParsed(sql, parsed, context.userId);
    if (!result) {
      result =
        parsed.type === "unknown"
          ? `Nicht erkannt. ${agentHelpText()}`
          : "Keine Aktion.";
    }
    await sql`
      insert into agent_commands (shop_id, channel, input, result, user_id)
      values (${SHOP}, ${data.channel}, ${data.text}, ${result}, ${context.userId})
    `;
    return { result, parsedType: parsed.type };
  });

async function runReminderPass(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
): Promise<string> {
  const rows = await sql<{
    id: number;
    customer_name: string;
    email: string | null;
    phone: string;
    preferred_date: string | null;
    preferred_slot: string | null;
    package_id: string;
  }>`
    select id, customer_name, email, phone, preferred_date, preferred_slot, package_id
    from bookings
    where shop_id = ${SHOP}
      and status = 'bestaetigt'
      and preferred_date is not null
      and preferred_date <= (current_date + interval '1 day')
      and preferred_date >= current_date
  `;
  if (rows.length === 0) return "Keine Termine in den nächsten 24 Stunden.";
  for (const row of rows) {
    const body = `Erinnerung: ${row.customer_name}, ${row.package_id}, ${row.preferred_date} ${row.preferred_slot ?? ""}`.trim();
    if (isEmailAddress(row.email)) {
      await sql`
        insert into outbound_queue (shop_id, channel, to_addr, subject, body, booking_id, status)
        values (
          ${SHOP}, ${"email"}, ${row.email},
          ${`Terminerinnerung WG-${row.id}`}, ${body}, ${row.id}, ${OUTBOUND_QUEUED}
        )
      `;
    }
    await sql`
      insert into documents (shop_id, booking_id, kind, title, amount_cents, status, body, created_by)
      values (
        ${SHOP}, ${row.id}, ${"erinnerung"}, ${`Terminerinnerung WG-${row.id}`},
        ${0}, ${"entwurf"}, ${body}, ${userId}
      )
    `;
  }
  await sql`
    insert into automation_events (shop_id, area, event, severity, context)
    values (${SHOP}, ${"erinnerung"}, ${"lauf"}, ${"info"}, ${`${rows.length} Erinnerungen`})
  `;
  return `${rows.length} Erinnerung(en) in die Versandliste gelegt.`;
}

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const [neu] = await sql<{ n: number }>`
      select count(*)::int as n from bookings where shop_id = ${SHOP} and status = 'neu'
    `;
    const [today] = await sql<{ n: number }>`
      select count(*)::int as n from bookings
      where shop_id = ${SHOP} and preferred_date = current_date and status in ('neu', 'bestaetigt')
    `;
    const [unread] = await sql<{ n: number }>`
      select count(*)::int as n from inbox_messages
      where shop_id = ${SHOP} and read_at is null and direction = 'in'
    `;
    const [volume] = await sql<{ n: number; sum: number }>`
      select count(*)::int as n, coalesce(sum(total_cents), 0)::int as sum
      from bookings where shop_id = ${SHOP} and status in ('bestaetigt', 'erledigt')
    `;
    const [mail] = await sql<{ n: number }>`
      select count(*)::int as n from outbound_queue
      where shop_id = ${SHOP} and channel = 'email'
    `;
    const [wa] = await sql<{ n: number }>`
      select count(*)::int as n from outbound_queue
      where shop_id = ${SHOP} and channel = 'whatsapp'
    `;
    const [tg] = await sql<{ n: number }>`
      select count(*)::int as n from outbound_queue
      where shop_id = ${SHOP} and channel = 'telegram'
    `;
    return {
      neu: neu?.n ?? 0,
      today: today?.n ?? 0,
      unread: unread?.n ?? 0,
      confirmedCount: volume?.n ?? 0,
      confirmedCents: volume?.sum ?? 0,
      outboundEmail: mail?.n ?? 0,
      outboundWhatsapp: wa?.n ?? 0,
      outboundTelegram: tg?.n ?? 0,
    };
  });

export const calendarIcs = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      customer_name: string;
      package_id: string;
      preferred_date: string | null;
      preferred_slot: string | null;
      total_cents: number;
    }>`
      select id, customer_name, package_id, preferred_date, preferred_slot, total_cents
      from bookings
      where shop_id = ${SHOP}
        and status in ('neu', 'bestaetigt')
        and preferred_date is not null
      order by preferred_date, preferred_slot
    `;
    const ics = buildCalendarIcs(
      rows
        .filter((r) => r.preferred_date)
        .map((r) => ({
          id: r.id,
          title: `${r.customer_name} · ${packages.find((p) => p.id === r.package_id)?.name ?? r.package_id}`,
          date: r.preferred_date as string,
          slot: r.preferred_slot,
          description: `WG-${r.id} · ${(r.total_cents / 100).toFixed(2)} EUR`,
        })),
    );
    return { filename: "white-gloss-termine.ics", ics, count: rows.length };
  });

export const runReminders = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const result = await runReminderPass(sql, context.userId);
    return { result };
  });

export const flushOutboundMail = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return flushOutboundEmailQueue(sql);
  });

export const listAutomationEvents = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    try {
      const sql = await getSql();
      return sql<{
        id: number;
        area: string;
        event: string;
        severity: string;
        context: string | null;
        created_at: string;
      }>`
        select id, area, event, severity, context, created_at
        from automation_events
        where shop_id = ${SHOP}
        order by created_at desc
        limit 80
      `;
    } catch {
      return [];
    }
  });

export const listOutbound = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    try {
      const sql = await getSql();
      return sql<{
        id: number;
        channel: string;
        to_addr: string | null;
        subject: string | null;
        status: string;
        created_at: string;
      }>`
        select id, channel, to_addr, subject, status, created_at
        from outbound_queue
        where shop_id = ${SHOP}
        order by created_at desc
        limit 40
      `;
    } catch {
      return [];
    }
  });

export const getOperatorSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    await ensureShopSettings(sql);
    const [row] = await sql<{ operator_pin: string; updated_at: string }>`
      select operator_pin, updated_at from shop_settings where shop_id = ${SHOP} limit 1
    `;
    return {
      pin: row?.operator_pin ?? "WG-BETRIEB",
      updatedAt: row?.updated_at ?? null,
    };
  });

export const setOperatorPin = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ pin: z.string().trim().min(6).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.pin === DEFAULT_OPERATOR_PIN) {
      throw new Error("Bitte einen eigenen PIN setzen, nicht den Vorgabewert.");
    }
    const sql = await getSql();
    await ensureShopSettings(sql);
    await sql`
      insert into shop_settings (shop_id, operator_pin, updated_at)
      values (${SHOP}, ${data.pin}, now())
      on conflict (shop_id) do update set operator_pin = excluded.operator_pin, updated_at = now()
    `;
    return { ok: true as const };
  });

export const inboundOperatorMessage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        pin: z.string().trim().min(4).max(40),
        text: z.string().trim().min(1).max(500),
        channel: z.enum(["whatsapp", "telegram"]).default("whatsapp"),
        useAi: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    assertPublicPostLimit("operator-inbound", 5, 15 * 60 * 1000);
    if (data.pin === DEFAULT_OPERATOR_PIN) {
      return { ok: false as const, result: "PIN ungültig." };
    }
    const sql = await getSql();
    await ensureShopSettings(sql);
    const [row] = await sql<{ operator_pin: string }>`
      select operator_pin from shop_settings where shop_id = ${SHOP} limit 1
    `;
    const pin = row?.operator_pin ?? "WG-BETRIEB";
    if (data.pin !== pin) {
      return { ok: false as const, result: "PIN ungültig." };
    }
    let parsed = parseAgentCommand(data.text);
    if (parsed.type === "unknown" && data.useAi) {
      const interpreted = await interpretWithGrok(data.text);
      if (interpreted) parsed = parseAgentCommand(interpreted);
    }
    let result = await executeParsed(sql, parsed, `operator:${data.channel}`);
    if (!result) {
      result =
        parsed.type === "unknown" ? `Nicht erkannt. ${agentHelpText()}` : "Keine Aktion.";
    }
    await sql`
      insert into agent_commands (shop_id, channel, input, result, user_id)
      values (${SHOP}, ${data.channel}, ${data.text}, ${result}, ${`operator:${data.channel}`})
    `;
    return { ok: true as const, result, parsedType: parsed.type };
  });
