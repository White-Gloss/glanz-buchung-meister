import { site } from "../data/site.ts";
import type { Sql } from "./db.ts";

/** Confirmation is narrower than operator access: no domain or admin-list grant. */
export function isBookingOwner(
  user: { id: string; email: string | null; emailVerified: boolean },
  env = process.env,
): boolean {
  if (!user.id || user.id === "dev-user") return false;
  const ownerId = env.OWNER_USER_ID?.trim();
  if (ownerId) return user.id === ownerId;
  const email = (env.OWNER_EMAIL?.trim() || site.email).toLowerCase();
  return user.emailVerified === true && user.email?.trim().toLowerCase() === email;
}

export async function canConfirmBookings(sql: Sql, userId: string): Promise<boolean> {
  if (!userId || userId === "dev-user") return false;
  const [user] = await sql<{ id: string; email: string | null; emailVerified: boolean }>`
    select id,email,"emailVerified" from "user" where id=${userId}
  `;
  return Boolean(user && isBookingOwner(user));
}

export async function requireBookingOwner(sql: Sql, userId: string): Promise<void> {
  if (!(await canConfirmBookings(sql, userId))) {
    throw new Error("Nur der angemeldete Inhaber darf Termine bestätigen.");
  }
}
