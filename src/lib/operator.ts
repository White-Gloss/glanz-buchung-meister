import { site } from "../data/site.ts";

function csv(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** E-Mails, die das Betriebspanel nutzen dürfen. */
export function operatorEmails(): string[] {
  const extra = csv(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL).map((value) =>
    value.toLowerCase(),
  );
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

export function operatorProviderAccounts(): string[] {
  const mapped = csv(process.env.ADMIN_PROVIDER_ACCOUNTS).map((entry) => entry.toLowerCase());
  const xAccounts = csv(process.env.ADMIN_X_ACCOUNT_IDS).map((id) => `grok-x:${id.toLowerCase()}`);
  const ownerX = (process.env.OWNER_X_ACCOUNT_ID || "").trim().toLowerCase();
  const allowed = new Set<string>([...mapped, ...xAccounts]);
  if (ownerX) allowed.add(`grok-x:${ownerX}`);
  return [...allowed];
}

export function isOperatorProviderAccount(
  providerId: string | null | undefined,
  accountId: string | null | undefined,
): boolean {
  if (!providerId || !accountId) return false;
  const key = `${providerId.trim().toLowerCase()}:${accountId.trim().toLowerCase()}`;
  return operatorProviderAccounts().includes(key);
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
  const accounts = await sql<{ providerId: string | null; accountId: string | null }>`
    select "providerId" as "providerId", "accountId" as "accountId"
    from "account"
    where "userId" = ${userId}
  `;
  if (accounts.some((account) => isOperatorProviderAccount(account.providerId, account.accountId))) {
    return;
  }

  throw new Error("Kein Betriebszugang.");
}
