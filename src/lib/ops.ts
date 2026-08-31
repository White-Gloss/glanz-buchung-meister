type Sql = Awaited<ReturnType<typeof import("./db").getSql>>;

export type BookingLite = {
  id: number;
  customer_name: string;
  email?: string | null;
  phone: string;
  package_id: string;
  preferred_date?: string | null;
  preferred_slot?: string | null;
};

export async function safeExec(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[ops:${label}]`, err);
  }
}

async function queueChannel(
  sql: Sql,
  booking: BookingLite,
  channel: "email" | "whatsapp" | "telegram",
  to: string,
  subject: string,
  body: string,
) {
  await sql`
    insert into outbound_queue (shop_id, channel, to_addr, subject, body, booking_id, status)
    values (
      ${"white-gloss"}, ${channel}, ${to}, ${subject}, ${body}, ${booking.id}, ${"sent"}
    )
  `;
  await sql`
    insert into inbox_messages (shop_id, channel, direction, sender, subject, body, booking_id)
    values (
      ${"white-gloss"}, ${channel}, ${"out"}, ${"White Gloss"}, ${subject}, ${body}, ${booking.id}
    )
  `;
}

export async function queueOwnerNotify(sql: Sql, booking: BookingLite, kind: string) {
  const subject = `Neue ${kind} WG-${booking.id}`;
  const body = [
    `${booking.customer_name}`,
    booking.phone,
    booking.email || "",
    booking.package_id,
    booking.preferred_date
      ? `${booking.preferred_date} ${booking.preferred_slot ?? ""}`.trim()
      : "ohne Wunschtermin",
  ]
    .filter(Boolean)
    .join(" · ");
  await safeExec("owner-whatsapp", () =>
    queueChannel(sql, booking, "whatsapp", booking.phone, subject, body),
  );
  await safeExec("owner-telegram", () =>
    queueChannel(sql, booking, "telegram", "betrieb", subject, body),
  );
}

export async function queueBookingAutomation(
  sql: Sql,
  booking: BookingLite,
  status: string,
  userId: string,
) {
  if (status !== "bestaetigt") return;
  const when = booking.preferred_date
    ? `${booking.preferred_date}${booking.preferred_slot ? ` ${booking.preferred_slot}` : ""}`
    : "wird telefonisch abgestimmt";
  const text = [
    `Guten Tag ${booking.customer_name},`,
    "",
    `Ihr Termin für ${booking.package_id} ist bestätigt (WG-${booking.id}).`,
    `Zeitfenster: ${when}`,
    "Ausführung: Arnistal 27, 72160 Horb am Neckar.",
    "",
    "White Gloss Detailing",
  ].join("\n");
  const subject = `Termin bestätigt · White Gloss WG-${booking.id}`;
  await safeExec("confirm-mail", () =>
    queueChannel(sql, booking, "email", booking.email || booking.phone, subject, text),
  );
  await safeExec("confirm-whatsapp", () =>
    queueChannel(sql, booking, "whatsapp", booking.phone, subject, text),
  );
  await safeExec("confirm-telegram", () =>
    queueChannel(sql, booking, "telegram", booking.phone, subject, text),
  );
  if (booking.preferred_date) {
    const reminder = `Erinnerung: ${booking.customer_name}, ${booking.package_id}, ${when}`;
    await safeExec("confirm-reminder", () =>
      sql`
        insert into documents (shop_id, booking_id, kind, title, amount_cents, status, body, created_by)
        values (
          ${"white-gloss"}, ${booking.id}, ${"erinnerung"},
          ${`Terminerinnerung WG-${booking.id}`}, ${0}, ${"entwurf"}, ${reminder}, ${userId}
        )
      `,
    );
  }
  await safeExec("confirm-event", () =>
    sql`
      insert into automation_events (shop_id, area, event, severity, context)
      values (${"white-gloss"}, ${"buchung"}, ${"bestaetigt"}, ${"info"}, ${`WG-${booking.id}`})
    `,
  );
}
