import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Bitte geben Sie Ihren vollständigen Namen an (mind. 2 Zeichen)." })
    .max(100, { message: "Der Name darf höchstens 100 Zeichen lang sein." }),
  email: z
    .string()
    .trim()
    .min(1, { message: "Bitte geben Sie eine E-Mail-Adresse an." })
    .email({ message: "Diese E-Mail-Adresse ist ungültig – Beispiel: max@beispiel.de" })
    .max(255, { message: "Die E-Mail-Adresse darf höchstens 255 Zeichen lang sein." }),
  phone: z
    .string()
    .trim()
    .min(6, { message: "Bitte geben Sie eine erreichbare Telefonnummer an (mind. 6 Zeichen)." })
    .max(30, { message: "Die Telefonnummer darf höchstens 30 Zeichen lang sein." })
    .regex(/^[0-9+()/\s-]+$/, {
      message: "Nur Ziffern, Leerzeichen und die Zeichen + ( ) / - sind erlaubt.",
    }),
  plate: z
    .string()
    .trim()
    .min(4, { message: "Bitte geben Sie das vollständige Kennzeichen an, z. B. HOR-WG 1967." })
    .max(15, { message: "Das Kennzeichen darf höchstens 15 Zeichen lang sein." })
    .regex(/^[A-Za-zÄÖÜäöü]{1,3}[\s-]?[A-Za-zÄÖÜäöü]{1,2}[\s-]?\d{1,4}[EH]?$/, {
      message: "Format bitte wie HOR-WG 1967 (Ort – Buchstaben – Zahl).",
    }),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerField = keyof CustomerInput;

/** Validiert ein einzelnes Feld und liefert die Fehlermeldung oder undefined. */
export function validateCustomerField(field: CustomerField, value: string) {
  const result = customerSchema.shape[field].safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/** Validiert alle Felder und liefert eine Map aus Feld -> Fehlermeldung. */
export function validateCustomer(values: Record<CustomerField, string>) {
  const result = customerSchema.safeParse(values);
  if (result.success) return {} as Partial<Record<CustomerField, string>>;
  const errors: Partial<Record<CustomerField, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as CustomerField;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
