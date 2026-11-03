import { customerPhotos } from "../data/customer-photos.ts";
import { localProof, type CityLocalProof } from "../data/local-proof.ts";
import { cities, services } from "../data/site.ts";

/** Returns the confirmed local facts for a city, or undefined when nothing is filled in. */
export function localProofFor(slug: string): CityLocalProof | undefined {
  const proof = localProof[slug];
  if (!proof) return undefined;
  const hasContent =
    Boolean(proof.pickupDays?.trim()) ||
    Boolean(proof.handover?.trim()) ||
    (proof.references?.length ?? 0) > 0 ||
    (proof.faqs?.length ?? 0) > 0;
  return hasContent ? proof : undefined;
}

/** All visible copy of a city's local facts, e.g. for keyword-density checks. */
export function localProofText(proof: CityLocalProof | undefined): string {
  if (!proof) return "";
  return [
    proof.pickupDays ?? "",
    proof.handover ?? "",
    ...(proof.references ?? []).flatMap((r) => [r.vehicle, r.summary]),
    ...(proof.faqs ?? []).flatMap((f) => [f.question, f.answer]),
  ]
    .filter(Boolean)
    .join(" ");
}

const monthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;
const datePattern = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Privacy guards: published copy must not identify a customer. */
const privacyPatterns: { label: string; pattern: RegExp }[] = [
  { label: "E-Mail-Adresse", pattern: /[\w.+-]+@[\w-]+\.[\w.]+/ },
  { label: "Telefonnummer", pattern: /(?:\+?\d[\s/-]?){7,}/ },
  // German number plates such as "FDS-AB 123", "RW-K 1234H" or "TÜ XY 12E".
  // Model names like "BMW M3", "BMW X5" or "VW ID 3" stay allowed.
  { label: "Kennzeichen", pattern: /\b[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}\s?\d{1,4}[EH]?\b/ },
  { label: "Kennzeichen", pattern: /\b[A-ZÄÖÜ]{1,3}\s[A-Z]{1,2}\s\d{2,4}[EH]?\b/ },
  { label: "Straßenangabe", pattern: /\b\p{L}+(?:straße|strasse|str\.|weg|gasse|allee)\s+\d+/iu },
];

function checkText(field: string, text: string, min: number, max: number, problems: string[]) {
  const value = text.trim();
  if (value.length < min) problems.push(`${field}: mindestens ${min} Zeichen`);
  if (value.length > max) problems.push(`${field}: höchstens ${max} Zeichen`);
  for (const { label, pattern } of privacyPatterns) {
    if (pattern.test(value)) problems.push(`${field}: enthält vermutlich ${label}`);
  }
}

/**
 * Checks completeness and privacy of one entry. It cannot check truth: every
 * entry stays an editorial confirmation by the operator.
 */
export function validateLocalProof(slug: string, proof: CityLocalProof, today: Date): string[] {
  const problems: string[] = [];
  const todayIso = today.toISOString().slice(0, 10);

  if (!cities.some((c) => c.slug === slug)) problems.push(`${slug}: unbekannter Abholort`);
  if (!datePattern.test(proof.confirmedAt)) {
    problems.push(`${slug}: confirmedAt muss JJJJ-MM-TT sein`);
  } else if (proof.confirmedAt > todayIso) {
    problems.push(`${slug}: confirmedAt liegt in der Zukunft`);
  }

  if (proof.pickupDays !== undefined)
    checkText(`${slug}.pickupDays`, proof.pickupDays, 5, 160, problems);
  if (proof.handover !== undefined)
    checkText(`${slug}.handover`, proof.handover, 20, 400, problems);

  for (const [i, ref] of (proof.references ?? []).entries()) {
    const at = `${slug}.references[${i}]`;
    if (!monthPattern.test(ref.month)) problems.push(`${at}.month muss JJJJ-MM sein`);
    else if (ref.month > todayIso.slice(0, 7)) problems.push(`${at}.month liegt in der Zukunft`);
    const service = services.find((s) => s.slug === ref.service);
    if (!service) problems.push(`${at}.service: unbekannte Leistung ${ref.service}`);
    else if (service.pendingApproval)
      problems.push(`${at}.service: ${ref.service} ist nicht buchbar`);
    if (ref.photoId !== undefined && !customerPhotos.some((p) => p.id === ref.photoId)) {
      problems.push(`${at}.photoId: unbekanntes Foto ${ref.photoId}`);
    }
    if (ref.consent !== true) problems.push(`${at}: Einverständnis fehlt`);
    checkText(`${at}.vehicle`, ref.vehicle, 3, 60, problems);
    checkText(`${at}.summary`, ref.summary, 40, 400, problems);
  }

  for (const [i, faq] of (proof.faqs ?? []).entries()) {
    const at = `${slug}.faqs[${i}]`;
    if (!faq.question.trim().endsWith("?")) problems.push(`${at}.question muss mit ? enden`);
    checkText(`${at}.question`, faq.question, 10, 160, problems);
    checkText(`${at}.answer`, faq.answer, 30, 600, problems);
  }

  return problems;
}

/** "2026-10" → "Oktober 2026". */
export function formatProofMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}

/** "2026-11-03" → "03.11.2026". */
export function formatProofDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}
