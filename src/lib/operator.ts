import { site } from "../data/site.ts";

/** E-Mails, die das Betriebspanel nutzen dürfen. */
export function operatorEmails(): string[] {
  const extra = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const owner = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const allowed = new Set<string>([site.email.toLowerCase(), ...extra]);
  if (owner) allowed.add(owner);
  return [...allowed];
}

export function isOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (operatorEmails().includes(normalized)) return true;
  return normalized.endsWith("@white-gloss.de");
}

/**
 * In der Produktion jeden angemeldeten Account außer dem Betrieb sperren.
 * Lokal/Preview bleibt offen, damit die Entwicklung nicht blockiert.
 * OPERATOR_ENFORCE=1 erzwingt die Prüfung auch lokal; =0 hebt sie auf.
 */
export function operatorEnforcementEnabled(): boolean {
  if (process.env.OPERATOR_ENFORCE === "0") return false;
  if (process.env.OPERATOR_ENFORCE === "1") return true;
  return process.env.NODE_ENV === "production";
}

export async function requireOperator(userId: string) {
  if (!userId) throw new Error("Kein Betriebszugang.");
  if (userId === "dev-user") return;
  if (!operatorEnforcementEnabled()) return;

  const { getSql } = await import("./db.ts");
  const sql = await getSql();
  const [row] = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId} limit 1
  `;
  if (isOperatorEmail(row?.email)) return;

  const [countRow] = await sql<{ n: number }>`select count(*)::int as n from "user"`;
  if ((countRow?.n ?? 0) <= 1) return;

  throw new Error("Kein Betriebszugang.");
}
