import { isEmailAddress } from "./utils.ts";

export type PublicFormField =
  "name" | "phone" | "email" | "date" | "note" | "privacy" | "media" | "text";
export type PublicFormErrors = Partial<Record<PublicFormField, string>>;

type ContactFields = { name: string; phone: string; privacy: boolean };

function contactErrors({ name, phone, privacy }: ContactFields): PublicFormErrors {
  const errors: PublicFormErrors = {};
  // Match the existing public booking/photo-inquiry server validators.
  if (name.trim().length < 2 || name.trim().length > 120) {
    errors.name = "Bitte einen Namen mit 2 bis 120 Zeichen angeben.";
  }
  if (phone.trim().length < 6 || phone.trim().length > 40) {
    errors.phone = "Bitte eine Telefonnummer mit 6 bis 40 Zeichen angeben.";
  }
  if (!privacy) errors.privacy = "Bitte die Datenschutzerklärung bestätigen.";
  return errors;
}

export function bookingFormErrors(
  values: ContactFields & { email: string; date: string; note: string },
  today: string,
): PublicFormErrors {
  const errors = contactErrors(values);
  if (values.email.trim() && !isEmailAddress(values.email)) {
    errors.email = "Bitte eine gültige E-Mail angeben oder das Feld leer lassen.";
  }
  if (values.date && values.date < today) {
    errors.date = "Bitte einen Wunschtermin ab heute wählen.";
  }
  if (values.note.length > 2000)
    errors.note = "Bitte den Hinweis auf höchstens 2000 Zeichen kürzen.";
  return errors;
}

export function photoInquiryErrors(
  values: ContactFields & { text: string; files: readonly { name: string }[] },
): PublicFormErrors {
  const errors = contactErrors(values);
  if (!values.text.trim() && values.files.length === 0) {
    errors.text = "Bitte eine kurze Beschreibung angeben oder mindestens eine Aufnahme wählen.";
  }
  if (values.text.length > 2000)
    errors.text = "Bitte die Beschreibung auf höchstens 2000 Zeichen kürzen.";
  if (values.files.some((file) => file.name.length > 180)) {
    errors.media =
      "Bitte Dateinamen auf höchstens 180 Zeichen kürzen und die Dateien erneut wählen.";
  }
  return errors;
}
