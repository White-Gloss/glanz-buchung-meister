/** Europe/Berlin wall-clock helpers. DST is resolved by matching formatted parts. */

const TZ = "Europe/Berlin";

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  return Number(parts.find((entry) => entry.type === type)?.value);
}

const berlinStamp = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function berlinWallToUtc(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Ungültiges Datum oder ungültige Uhrzeit.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 4; i += 1) {
    const parts = berlinStamp.formatToParts(new Date(utc));
    const asIf = Date.UTC(
      part(parts, "year"),
      part(parts, "month") - 1,
      part(parts, "day"),
      part(parts, "hour"),
      part(parts, "minute"),
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    const delta = wanted - asIf;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export function utcToBerlinWall(value: Date): { date: string; time: string } {
  const parts = berlinStamp.formatToParts(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${part(parts, "year")}-${pad(part(parts, "month"))}-${pad(part(parts, "day"))}`,
    time: `${pad(part(parts, "hour"))}:${pad(part(parts, "minute"))}`,
  };
}

export function isoOffset(value: Date): string {
  const wall = utcToBerlinWall(value);
  const asUtc = Date.UTC(
    Number(wall.date.slice(0, 4)),
    Number(wall.date.slice(5, 7)) - 1,
    Number(wall.date.slice(8, 10)),
    Number(wall.time.slice(0, 2)),
    Number(wall.time.slice(3, 5)),
  );
  const offsetMin = Math.round((asUtc - value.getTime()) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${wall.date}T${wall.time}:00${sign}${hh}:${mm}`;
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export const defaultDurationMinutes: Record<string, number> = {
  basis: 180,
  premium: 360,
  keramik: 1920,
};

export function defaultWorkEnd(packageId: string, start: Date): Date {
  const minutes = defaultDurationMinutes[packageId] ?? 180;
  return new Date(start.getTime() + minutes * 60_000);
}

export function formatBerlinRange(start: Date, end: Date): string {
  const from = utcToBerlinWall(start);
  const to = utcToBerlinWall(end);
  const sameDay = from.date === to.date;
  const dateFmt = (iso: string) =>
    new Intl.DateTimeFormat("de-DE", {
      timeZone: TZ,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${iso}T12:00:00+01:00`));
  if (sameDay) return `${dateFmt(from.date)}, ${from.time}–${to.time} Uhr`;
  return `${dateFmt(from.date)} ${from.time} Uhr bis ${dateFmt(to.date)} ${to.time} Uhr`;
}
