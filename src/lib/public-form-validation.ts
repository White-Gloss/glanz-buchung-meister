import { isEmailAddress } from "./utils.ts";
import { isCalendarDate } from "./calendar-date.ts";

export type PublicFormField =
  "name" | "phone" | "email" | "date" | "note" | "privacy" | "media" | "text";
export type PublicFormErrors = Partial<Record<PublicFormField, string>>;

type ContactFields = { name: string; phone: string; privacy: boolean };

function contactErrors({ name, phone, privacy }: ContactFields): PublicFormErrors {
  const errors: PublicFormErrors = {};
  // Match the existing public booking/photo-inquiry server validators.
  if (name.trim().length < 2 || name.trim().length > 120) {
    errors.name = "Bitte geben Sie Ihren Namen mit 2 bis 120 Zeichen an.";
  }
  if (phone.trim().length < 6 || phone.trim().length > 40) {
    errors.phone = "Bitte geben Sie Ihre Telefonnummer mit 6 bis 40 Zeichen an.";
  }
  if (!privacy) errors.privacy = "Bitte bestätigen Sie, dass Sie die Datenschutzerklärung zur Kenntnis genommen haben.";
  return errors;
}

export function bookingFormErrors(
  values: ContactFields & { email: string; date: string; note: string },
  today: string,
): PublicFormErrors {
  const errors = contactErrors(values);
  if (values.email.trim().length > 160 || (values.email.trim() && !isEmailAddress(values.email))) {
    errors.email = "Bitte geben Sie eine gültige E-Mail-Adresse an oder lassen Sie das Feld leer.";
  }
  if (values.date && (!isCalendarDate(values.date) || values.date < today)) {
    errors.date = "Bitte wählen Sie heute oder ein späteres Datum.";
  }
  if (values.note.length > 2000)
    errors.note = "Bitte kürzen Sie Ihre Nachricht auf höchstens 2.000 Zeichen.";
  return errors;
}

export function photoInquiryErrors(
  values: ContactFields & { text: string; files: readonly { name: string }[] },
): PublicFormErrors {
  const errors = contactErrors(values);
  if (!values.text.trim() && values.files.length === 0) {
    errors.text = "Bitte beschreiben Sie Ihr Anliegen oder wählen Sie mindestens eine Aufnahme aus.";
  }
  if (values.text.length > 2000)
    errors.text = "Bitte kürzen Sie die Beschreibung auf höchstens 2.000 Zeichen.";
  if (values.files.some((file) => file.name.length > 180)) {
    errors.media =
      "Bitte kürzen Sie die Dateinamen auf höchstens 180 Zeichen und wählen Sie die Dateien erneut aus.";
  }
  return errors;
}
