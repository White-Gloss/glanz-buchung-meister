import { z } from "zod";
import { berlinCalendarDate } from "./ops.ts";
import { isEmailAddress } from "./utils.ts";
import { isCalendarDate } from "./calendar-date.ts";

/**
 * Shared validation for the public booking form. Enforced on the server in
 * `createPublicBooking`; the same past-date rule lives client-side in
 * `configurator.tsx` only for immediate feedback. The past-date comparison
 * uses Europe/Berlin calendar days, matching the client check.
 */
export const publicBookingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
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
  slot: z.string().max(10).optional(),
  note: z.string().max(2000).optional(),
  packageId: z.enum(["basis", "premium", "keramik"]),
  classId: z.enum(["kompakt", "suv", "transporter"]),
  extraIds: z.array(z.string().max(40)).max(20),
  citySlug: z.string().max(80),
  kind: z.enum(["booking", "dent", "condition"]).default("booking"),
  privacy: z.literal(true),
  website: z.string().max(120).optional(),
});

export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
