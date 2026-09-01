/** RFC 5545 helpers for the private White-Gloss calendar feed. */

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, "\\n");
}

function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function compactDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

export function icsTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function slotToHours(slot: string | null | undefined): { start: string; end: string } | null {
  if (!slot || !/^\d{2}:\d{2}$/.test(slot)) return null;
  const [h, m] = slot.split(":").map(Number);
  const start = `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
  const endH = Math.min(h + 2, 23);
  const end = `${String(endH).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
  return { start, end };
}

export type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  slot?: string | null;
  description?: string;
};

export function buildCalendarIcs(events: CalendarEvent[]): string {
  const stamp = icsTimestamp(new Date());
  const blocks = events.map((event) => {
    const day = compactDate(event.date);
    const timed = slotToHours(event.slot);
    const start = timed
      ? `DTSTART;TZID=Europe/Berlin:${day}T${timed.start}`
      : `DTSTART;VALUE=DATE:${day}`;
    const end = timed
      ? `DTEND;TZID=Europe/Berlin:${day}T${timed.end}`
      : `DTEND;VALUE=DATE:${shiftDay(event.date, 1)}`;
    const lines = [
      "BEGIN:VEVENT",
      `UID:booking-${event.id}@white-gloss.de`,
      `DTSTAMP:${stamp}`,
      start,
      end,
      `SUMMARY:${escapeIcsText(event.title)}`,
    ];
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    lines.push("LOCATION:Arnistal 27\\, 72160 Horb am Neckar", "END:VEVENT");
    return lines.join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//White Gloss//Betrieb//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:White Gloss Termine",
    "X-WR-TIMEZONE:Europe/Berlin",
    ...blocks,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
