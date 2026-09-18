import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function hubSecretConfigured(secret = process.env.HUB_SYNC_TOKEN): boolean {
  const value = secret?.trim() ?? "";
  return value.length >= 32 && value.length <= 4096 && !/[\r\n]/.test(value);
}

export function hubAuthorized(header: string | null, secret = process.env.HUB_SYNC_TOKEN): boolean {
  if (!hubSecretConfigured(secret) || !header?.startsWith("Bearer ")) return false;
  const expected = Buffer.from(secret!.trim());
  const received = Buffer.from(header.slice(7).trim());
  return received.length === expected.length && timingSafeEqual(received, expected);
}

const details = {
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(40)
    .regex(/^\+?[\d ()/.-]+$/, "Ungültige Telefonnummer"),
  email: z.string().trim().max(160).optional(),
  date: z.string().max(20).optional(),
  slot: z.string().max(10).optional(),
  packageId: z.enum(["basis", "premium", "keramik"]),
  classId: z.enum(["kompakt", "suv", "transporter"]),
  extraIds: z.array(z.string().max(40)).max(20).default([]),
  citySlug: z.string().max(80).optional(),
  note: z.string().max(2000).optional(),
};

export const hubRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({
    action: z.literal("confirm"),
    id: z.number().int().positive(),
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    action: z.literal("status"),
    id: z.number().int().positive(),
    expectedVersion: z.number().int().nonnegative(),
    status: z.enum(["abgelehnt", "storniert", "erledigt", "nicht_erschienen"]),
  }),
  z.object({
    action: z.literal("edit"),
    id: z.number().int().positive(),
    expectedVersion: z.number().int().nonnegative(),
    ...details,
  }),
  z.object({
    action: z.literal("create"),
    ...details,
    notifyCustomer: z.boolean().optional(),
  }),
  z.object({ action: z.literal("qonto_ensure"), id: z.number().int().positive() }),
  z.object({ action: z.literal("qonto_send"), id: z.number().int().positive() }),
]);

export type HubRequest = z.infer<typeof hubRequestSchema>;
