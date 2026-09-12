import { randomBytes } from "node:crypto";
import type { Sql } from "./db.ts";
import {
  booksListTaxes,
  crmSearch,
  exchangeAuthorizationCode,
  normalizeZohoDc,
  zohoRequest,
  ZohoError,
  type ZohoCredentials,
} from "./zoho.ts";
import { readZohoCredentials } from "./zoho-credentials.server.ts";
import { ensureZohoSchema } from "./zoho-ops.ts";

const SHOP = "white-gloss";

export type TaxOption = { tax_id?: string; tax_percentage?: number; tax_name?: string };

export function pickGermanStandardVat(taxes: TaxOption[]) {
  return (
    taxes.find((tax) => Number(tax.tax_percentage) === 19 && Boolean(tax.tax_id?.trim())) ?? null
  );
}

export type ZohoSetupReport = {
  auth: boolean;
  dc: string;
  orgId: string | null;
  orgName: string | null;
  tax19: { taxId: string; name: string } | null;
  crm: boolean;
  webhookReady: boolean;
  webhookSecretPreview: string | null;
  errors: string[];
};

async function listOrganizations(creds: ZohoCredentials) {
  return zohoRequest<{
    organizations?: { organization_id?: string; name?: string; country?: string }[];
  }>(creds, { path: "/books/v3/organizations" });
}

export async function applyZohoSetup(
  sql: Sql,
  input: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    grantCode?: string;
    booksOrgId?: string;
  },
): Promise<ZohoSetupReport> {
  await ensureZohoSchema(sql);
  await sql`
    insert into shop_settings (shop_id)
    values (${SHOP})
    on conflict (shop_id) do nothing
  `;
  const current = await sql<{
    zoho_client_id: string | null;
    zoho_client_secret: string | null;
    zoho_refresh_token: string | null;
    zoho_books_org_id: string | null;
    zoho_webhook_secret: string | null;
  }>`
    select zoho_client_id, zoho_client_secret, zoho_refresh_token, zoho_books_org_id, zoho_webhook_secret
    from shop_settings where shop_id = ${SHOP}
  `;
  const row = current[0];
  const clientId = input.clientId?.trim() || row?.zoho_client_id?.trim() || "";
  const clientSecret = input.clientSecret?.trim() || row?.zoho_client_secret?.trim() || "";
  let refreshToken = input.refreshToken?.trim() || row?.zoho_refresh_token?.trim() || "";
  const booksOrgId = input.booksOrgId?.trim() || row?.zoho_books_org_id?.trim() || "";
  const grantCode = input.grantCode?.trim() || "";

  if (grantCode) {
    if (!clientId || !clientSecret) {
      return {
        auth: false,
        dc: "eu",
        orgId: booksOrgId || null,
        orgName: null,
        tax19: null,
        crm: false,
        webhookReady: false,
        webhookSecretPreview: null,
        errors: [
          "Client-ID und Secret fehlen. Die stehen in der Zoho-Konsole unter Self Client → Client Secret.",
        ],
      };
    }
    try {
      const exchanged = await exchangeAuthorizationCode({
        dc: "eu",
        clientId,
        clientSecret,
        code: grantCode,
      });
      refreshToken = exchanged.refreshToken;
    } catch (error) {
      const expired = error instanceof ZohoError && error.code === "zoho_grant_expired";
      return {
        auth: false,
        dc: "eu",
        orgId: booksOrgId || null,
        orgName: null,
        tax19: null,
        crm: false,
        webhookReady: false,
        webhookSecretPreview: null,
        errors: [
          expired
            ? "Der Code aus Zoho war abgelaufen. Noch einmal Generate Code klicken und sofort hier einfügen — er gilt nur wenige Minuten."
            : "Zoho hat den Code nicht angenommen. Prüfe, ob die Konsole api-console.zoho.eu ist (Europa) und CRM plus Books ausgewählt wurden.",
        ],
      };
    }
  }

  let webhook = row?.zoho_webhook_secret?.trim() || "";
  let webhookCreated = false;
  if (webhook.length < 24) {
    webhook = randomBytes(24).toString("hex");
    webhookCreated = true;
  }

  await sql`
    update shop_settings set
      zoho_dc = ${"eu"},
      zoho_client_id = ${clientId || null},
      zoho_client_secret = ${clientSecret || null},
      zoho_refresh_token = ${refreshToken || null},
      zoho_books_org_id = ${booksOrgId || null},
      zoho_webhook_secret = ${webhook},
      updated_at = now()
    where shop_id = ${SHOP}
  `;

  const report = await probeZohoSetup(sql);
  if (webhookCreated && report.webhookReady) {
    report.webhookSecretPreview = webhook;
  }
  return report;
}

export async function probeZohoSetup(sql: Sql): Promise<ZohoSetupReport> {
  await ensureZohoSchema(sql);
  const errors: string[] = [];
  const creds = await readZohoCredentials(sql);
  const [stored] = await sql<{ zoho_webhook_secret: string | null; zoho_dc: string | null }>`
    select zoho_webhook_secret, zoho_dc from shop_settings where shop_id = ${SHOP}
  `;
  const webhook =
    (process.env.ZOHO_WEBHOOK_SECRET || "").trim() || stored?.zoho_webhook_secret?.trim() || "";
  const report: ZohoSetupReport = {
    auth: false,
    dc: creds?.dc || normalizeZohoDc(stored?.zoho_dc) || "eu",
    orgId: creds?.booksOrgId || null,
    orgName: null,
    tax19: null,
    crm: false,
    webhookReady: webhook.length >= 24,
    webhookSecretPreview: null,
    errors,
  };
  if (!creds) {
    errors.push(
      "Client-ID, Secret und Refresh-Token fehlen. Die lege ich nicht an — die kommen aus der Zoho-API-Konsole (Self Client, EU).",
    );
    return report;
  }

  try {
    const orgs = await listOrganizations(creds);
    report.auth = true;
    const list = orgs.data.organizations || [];
    const chosen =
      list.find((item) => item.organization_id === creds.booksOrgId) ||
      (list.length === 1 ? list[0] : undefined);
    if (chosen?.organization_id) {
      report.orgId = chosen.organization_id;
      report.orgName = chosen.name || null;
      if (!creds.booksOrgId) {
        await sql`
          update shop_settings set zoho_books_org_id = ${chosen.organization_id}, updated_at = now()
          where shop_id = ${SHOP}
        `;
        creds.booksOrgId = chosen.organization_id;
      }
    } else if (!creds.booksOrgId) {
      errors.push(
        list.length
          ? "Mehrere Books-Organisationen. Bitte die deutsche Mandanten-ID setzen."
          : "Keine Books-Organisation gefunden.",
      );
    }
  } catch {
    errors.push("OAuth abgelehnt oder EU-Konto nicht erreichbar. Grant-Code/Refresh-Token prüfen — nicht hier einfügen.");
    return report;
  }

  if (creds.booksOrgId) {
    try {
      const taxes = await booksListTaxes(creds);
      const vat = pickGermanStandardVat(taxes.data.taxes || []);
      if (vat?.tax_id) {
        report.tax19 = { taxId: vat.tax_id, name: vat.tax_name || "19 %" };
        await sql`
          update shop_settings set zoho_tax_id = ${vat.tax_id}, zoho_books_org_id = ${creds.booksOrgId}, updated_at = now()
          where shop_id = ${SHOP}
        `;
      } else {
        errors.push(
          "In Zoho Books fehlt der 19-%-Steuersatz. Den lege ich nicht an und erfinde keine tax_id. In Books → Einstellungen → Steuern anlegen, dann erneut prüfen.",
        );
      }
    } catch {
      errors.push("Steuersätze aus Books konnten nicht gelesen werden.");
    }
  }

  try {
    await crmSearch(creds, "Contacts", "(Email:equals:probe@white-gloss.de)");
    report.crm = true;
  } catch {
    errors.push("CRM Contacts nicht erreichbar. Scopes Contacts/Deals/Events/Attachments prüfen.");
  }

  if (!report.webhookReady) {
    errors.push("Webhook-Geheimnis fehlt noch (mindestens 24 Zeichen).");
  }
  return report;
}
