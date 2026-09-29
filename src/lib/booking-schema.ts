import { z } from "zod";
import { berlinCalendarDate } from "./calendar-date.ts";
import { isEmailAddress } from "./utils.ts";
import { isCalendarDate } from "./calendar-date.ts";
import { extras, timeSlots } from "../data/site.ts";

/**
 * Shared validation for the public booking form. Enforced on the server in
 * `createPublicBooking`; the same past-date rule lives client-side in
 * `configurator.tsx` only for immediate feedback. The past-date comparison
 * uses Europe/Berlin calendar days, matching the client check.
 */
const bookingFields = z.object({
  idempotencyKey: z.string().uuid("Ungültige Anfragekennung."),
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(40)
    .regex(/^\+?[\d ()/.-]+$/, "Ungültige Telefonnummer"),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v.length === 0 || isEmailAddress(v), "Ungültige E-Mail"),
  date: z
    .string()
    .max(20)
    .optional()
    .refine((v) => !v || isCalendarDate(v), "Ungültiger Wunschtermin")
    .refine(
      (v) => !v || v >= berlinCalendarDate(),
      "Wunschtermin darf nicht in der Vergangenheit liegen",
    ),
  slot: z
    .string()
    .max(10)
    .optional()
    .refine((v) => !v || timeSlots.includes(v), "Ungültige Uhrzeit"),
  note: z.string().max(2000).optional(),
  packageId: z.enum(["basis", "premium", "keramik"]),
  classId: z.enum(["kompakt", "suv", "transporter"]),
  extraIds: z
    .array(z.string().max(40))
    .max(20)
    .refine(
      (ids) =>
        ids.every((id) => !extras.some((extra) => extra.id === id && extra.requestable === false)),
      "Eine gewählte Zusatzleistung ist derzeit nicht buchbar. Bitte aktualisieren Sie Ihre Auswahl.",
    ),
  citySlug: z.string().max(80),
  kind: z.enum(["booking", "dent", "condition"]).default("booking"),
  privacy: z.literal(true),
  reviewEmailConsent: z.boolean().optional(),
  website: z.string().max(120).optional(),
  vehicleMake: z.string().trim().max(80).optional(),
  vehicleModel: z.string().trim().max(80).optional(),
  vehiclePlate: z.string().trim().max(20).optional(),
  street: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(5).optional(),
  town: z.string().trim().max(80).optional(),
});

/** Online requests need an e-mail and a billing address; see public-form-validation. */
export const publicBookingSchema = bookingFields.extend({
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => isEmailAddress(v), "Bitte eine gültige E-Mail-Adresse angeben."),
  street: z.string().trim().min(3, "Bitte Straße und Hausnummer angeben.").max(120),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Bitte eine fünfstellige Postleitzahl angeben."),
  town: z.string().trim().min(2, "Bitte den Ort angeben.").max(80),
});

export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
/** Stored request shape shared by online and operator-recorded bookings. */
export type BookingRequestInput = z.infer<typeof bookingFields>;

/**
 * A signed-in operator records the request; no customer checkbox is impersonated.
 * Phone requests may lack e-mail and address, so these stay optional here.
 */
export const manualBookingSchema = bookingFields.omit({ privacy: true, website: true }).extend({
  notifyCustomer: z.boolean().default(false),
});
export type ManualBookingInput = z.infer<typeof manualBookingSchema>;
