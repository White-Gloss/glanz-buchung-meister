export const DENT_REPAIR_SERVICE_NAME = "Dellenentfernung & Hagelschaden-Reparatur";
export const DENT_REPAIR_PRICE_LABEL = "Preis nach Begutachtung";
export const DENT_REPAIR_PRICE_HEADING = "Individuelle Preisermittlung";
export const DENT_REPAIR_PRICE_NOTICE =
  "Die Kosten richten sich nach Größe, Anzahl, Lage und Zugänglichkeit der Beschädigungen. Der endgültige Preis wird nach einer persönlichen Begutachtung des Fahrzeugs vereinbart. Die Reparatur erfolgt erst nach ausdrücklicher Zustimmung des Kunden.";

export const dentDamageTypes = ["Parkdelle", "Hagelschaden", "Sonstige Delle"] as const;
export type DentDamageType = (typeof dentDamageTypes)[number];

export const dentAssessmentModes = ["Vor Ort", "Foto, wenn möglich"] as const;
export type DentAssessmentMode = (typeof dentAssessmentModes)[number];

export const dentRequestStatuses = ["Neu", "Gesehen", "Beantwortet", "Erledigt"] as const;
export type DentRequestStatus = (typeof dentRequestStatuses)[number];

export type DentRepairRequestInput = {
  damageType: string;
  vehicleArea: string;
  dentCount: string;
  dentSize: string;
  vehicleMake: string;
  vehicleModel: string;
  photoPaths: string[];
  name: string;
  email: string;
  phone: string;
  preferredDate: string;
  assessmentMode: string;
  note: string;
  consent: boolean;
};

export type NormalizedDentRepairRequest = {
  damageType: DentDamageType;
  vehicleArea: string;
  dentCount: string;
  dentSize: string;
  vehicleMake: string;
  vehicleModel: string;
  photoPaths: string[];
  name: string;
  email: string;
  phone: string;
  preferredDate: string;
  assessmentMode: DentAssessmentMode;
  note: string;
  consent: true;
};

const STORAGE_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/\d+-\d+\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, label: string, maxLength: number, minLength = 1): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minLength) throw new Error(`${label} ist ein Pflichtfeld.`);
  if (normalized.length > maxLength) {
    throw new Error(`${label} darf höchstens ${maxLength} Zeichen enthalten.`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label} darf höchstens ${maxLength} Zeichen enthalten.`);
  }
  return normalized;
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function normalizeDentRepairRequest(
  input: DentRepairRequestInput,
): NormalizedDentRepairRequest {
  const damageType = String(input.damageType ?? "") as DentDamageType;
  if (!dentDamageTypes.includes(damageType))
    throw new Error("Bitte eine gültige Schadensart wählen.");

  const assessmentMode = String(input.assessmentMode ?? "") as DentAssessmentMode;
  if (!dentAssessmentModes.includes(assessmentMode)) {
    throw new Error("Bitte eine gültige Art der Begutachtung wählen.");
  }

  const email = text(input.email, "E-Mail-Adresse", 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  }

  const phone = text(input.phone, "Telefonnummer", 40, 6);
  const preferredDate = String(input.preferredDate ?? "");
  if (!ISO_DATE.test(preferredDate) || preferredDate < localToday()) {
    throw new Error("Bitte einen zukünftigen Termin zur Begutachtung wählen.");
  }

  const photoPaths = [
    ...new Set(Array.isArray(input.photoPaths) ? input.photoPaths.map(String) : []),
  ];
  if (photoPaths.length > 8) throw new Error("Es sind höchstens 8 Fotos möglich.");
  if (photoPaths.some((path) => !STORAGE_PATH_PATTERN.test(path))) {
    throw new Error("Mindestens ein Foto konnte nicht sicher zugeordnet werden.");
  }
  if (!input.consent) throw new Error("Ihre Zustimmung zur Verarbeitung ist erforderlich.");

  return {
    damageType,
    vehicleArea: text(input.vehicleArea, "Betroffener Fahrzeugbereich", 160),
    dentCount: text(input.dentCount, "Ungefähre Anzahl der Dellen", 80),
    dentSize: text(input.dentSize, "Ungefähre Größe der Dellen", 120),
    vehicleMake: text(input.vehicleMake, "Fahrzeugmarke", 80),
    vehicleModel: text(input.vehicleModel, "Fahrzeugmodell", 120),
    photoPaths,
    name: text(input.name, "Name", 120, 2),
    email,
    phone,
    preferredDate,
    assessmentMode,
    note: optionalText(input.note, "Zusätzliche Hinweise", 2000),
    consent: true,
  };
}

export function formatDentAssessmentDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildDentRepairSummary(request: NormalizedDentRepairRequest): string {
  return [
    DENT_REPAIR_SERVICE_NAME,
    `Preis: ${DENT_REPAIR_PRICE_LABEL}`,
    `Schadensart: ${request.damageType}`,
    `Fahrzeugbereich: ${request.vehicleArea}`,
    `Dellen: ${request.dentCount}, ${request.dentSize}`,
    `Fahrzeug: ${request.vehicleMake} ${request.vehicleModel}`,
    `Begutachtung: ${request.assessmentMode} am ${formatDentAssessmentDate(request.preferredDate)}`,
    `Fotos: ${request.photoPaths.length}`,
  ].join("\n");
}
