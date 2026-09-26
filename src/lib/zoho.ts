/** Zoho CRM v8 and Books v3 HTTP client. EU accounts use zohoapis.eu. */

export type ZohoDc = "eu" | "com" | "in" | "com.au" | "jp" | "ca" | "uk";

export type ZohoCredentials = {
  dc: ZohoDc;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  accessExpiresAt?: number;
  booksOrgId?: string;
};

export class ZohoError extends Error {
  code: string;
  status: number | null;
  retryable: boolean;
  review: boolean;
  constructor(
    code: string,
    options: { status?: number | null; retryable?: boolean; review?: boolean } = {},
  ) {
    super(code);
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = Boolean(options.retryable);
    this.review = Boolean(options.review);
  }
}

const ACCOUNTS: Record<ZohoDc, string> = {
  eu: "https://accounts.zoho.eu",
  com: "https://accounts.zoho.com",
  in: "https://accounts.zoho.in",
  "com.au": "https://accounts.zoho.com.au",
  jp: "https://accounts.zoho.jp",
  ca: "https://accounts.zoho.ca",
  uk: "https://accounts.zoho.uk",
};

const APIS: Record<ZohoDc, string> = {
  eu: "https://www.zohoapis.eu",
  com: "https://www.zohoapis.com",
  in: "https://www.zohoapis.in",
  "com.au": "https://www.zohoapis.com.au",
  jp: "https://www.zohoapis.jp",
  ca: "https://www.zohoapis.ca",
  uk: "https://www.zohoapis.uk",
};

export function normalizeZohoDc(raw: string | null | undefined): ZohoDc {
  const value = (raw || "eu").trim().toLowerCase();
  if (value in ACCOUNTS) return value as ZohoDc;
  return "eu";
}

export function zohoCredentialsFromEnv(): ZohoCredentials | null {
  const clientId = (process.env.ZOHO_CLIENT_ID || "").trim();
  const clientSecret = (process.env.ZOHO_CLIENT_SECRET || "").trim();
  const refreshToken = (process.env.ZOHO_REFRESH_TOKEN || "").trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return {
    dc: normalizeZohoDc(process.env.ZOHO_DC),
    clientId,
    clientSecret,
    refreshToken,
    booksOrgId: (process.env.ZOHO_BOOKS_ORG_ID || "").trim() || undefined,
  };
}

export function zohoConfigured(): boolean {
  return zohoCredentialsFromEnv() !== null;
}

export function zohoOpsEnabledFromEnv(): boolean {
  return (process.env.ZOHO_OPS_ENABLED || "").trim() === "true";
}

type TokenState = { accessToken: string; expiresAt: number };

async function refreshAccessToken(creds: ZohoCredentials): Promise<TokenState> {
  const url = new URL("/oauth/v2/token", ACCOUNTS[creds.dc]);
  url.searchParams.set("refresh_token", creds.refreshToken);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("client_secret", creds.clientSecret);
  url.searchParams.set("grant_type", "refresh_token");
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new ZohoError("zoho_unreachable", { retryable: true });
  }
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    throw new ZohoError(
      response.status === 401 || body?.error === "invalid_code" ? "zoho_auth" : "zoho_token_failed",
      { status: response.status, retryable: response.status >= 500, review: response.status === 401 },
    );
  }
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + Math.max(30, Number(body.expires_in || 3600) - 60) * 1000,
  };
}

export async function exchangeAuthorizationCode(input: {
  dc?: string | null;
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<{ refreshToken: string }> {
  const dc = normalizeZohoDc(input.dc);
  const url = new URL("/oauth/v2/token", ACCOUNTS[dc]);
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("client_id", input.clientId.trim());
  url.searchParams.set("client_secret", input.clientSecret.trim());
  url.searchParams.set("code", input.code.trim());
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new ZohoError("zoho_unreachable", { retryable: true });
  }
  const body = (await response.json().catch(() => null)) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!body?.refresh_token) {
    throw new ZohoError(
      body?.error === "invalid_code" || body?.error === "invalid_grant"
        ? "zoho_grant_expired"
        : "zoho_grant_exchange",
      { status: response.status, review: true },
    );
  }
  return { refreshToken: body.refresh_token };
}

export type ZohoRequest = {
  method?: string;
  path: string;
  query?: Record<string, string | undefined>;
  json?: unknown;
  form?: FormData;
  books?: boolean;
};

export async function zohoRequest<T>(
  creds: ZohoCredentials,
  input: ZohoRequest,
  token?: TokenState | null,
): Promise<{ data: T; token: TokenState }> {
  const fresh =
    token && token.expiresAt > Date.now() + 5_000 ? token : await refreshAccessToken(creds);
  const url = new URL(input.path, APIS[creds.dc]);
  for (const [key, value] of Object.entries(input.query || {})) {
    if (value) url.searchParams.set(key, value);
  }
  if (input.books) {
    const org = creds.booksOrgId || (process.env.ZOHO_BOOKS_ORG_ID || "").trim();
    if (!org) throw new ZohoError("zoho_books_org_missing", { review: true });
    url.searchParams.set("organization_id", org);
  }
  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${fresh.accessToken}`,
  };
  let body: BodyInit | undefined;
  if (input.form) {
    body = input.form;
  } else if (input.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(input.json);
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: input.method || "GET",
      headers,
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ZohoError("zoho_unreachable", { retryable: true });
  }
  if (response.status === 401 && token) {
    return zohoRequest<T>(creds, input, null);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new ZohoError(`zoho_http_${response.status}`, {
      status: response.status,
      retryable: true,
    });
  }
  const payload = (await response.json().catch(() => null)) as T | { code?: string } | null;
  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && "code" in payload && payload.code
        ? String(payload.code)
        : `zoho_http_${response.status}`;
    throw new ZohoError(code, {
      status: response.status,
      review: response.status === 400 || response.status === 403,
    });
  }
  return { data: payload as T, token: fresh };
}

export type CrmRecord = { id?: string; [key: string]: unknown };

export async function crmSearch(
  creds: ZohoCredentials,
  moduleName: string,
  criteria: string,
  token?: TokenState | null,
) {
  return zohoRequest<{ data?: CrmRecord[] }>(
    creds,
    {
      path: `/crm/v8/${moduleName}/search`,
      query: { criteria },
    },
    token,
  );
}

export async function crmInsert(
  creds: ZohoCredentials,
  moduleName: string,
  record: Record<string, unknown>,
  token?: TokenState | null,
) {
  return zohoRequest<{ data?: { details?: { id?: string }; code?: string }[] }>(
    creds,
    { method: "POST", path: `/crm/v8/${moduleName}`, json: { data: [record] } },
    token,
  );
}

export async function crmUpdate(
  creds: ZohoCredentials,
  moduleName: string,
  id: string,
  record: Record<string, unknown>,
  token?: TokenState | null,
) {
  return zohoRequest<{ data?: { details?: { id?: string }; code?: string }[] }>(
    creds,
    { method: "PUT", path: `/crm/v8/${moduleName}`, json: { data: [{ id, ...record }] } },
    token,
  );
}

export async function crmUploadAttachment(
  creds: ZohoCredentials,
  moduleName: string,
  id: string,
  file: { filename: string; bytes: Uint8Array; mime: string },
  token?: TokenState | null,
) {
  const form = new FormData();
  form.set(
    "file",
    new Blob([Buffer.from(file.bytes)], { type: file.mime }),
    file.filename,
  );
  return zohoRequest(
    creds,
    { method: "POST", path: `/crm/v8/${moduleName}/${id}/Attachments`, form },
    token,
  );
}

export async function booksCreateContact(
  creds: ZohoCredentials,
  contact: Record<string, unknown>,
  token?: TokenState | null,
) {
  return zohoRequest<{ contact?: { contact_id?: string } }>(
    creds,
    { method: "POST", path: "/books/v3/contacts", json: contact, books: true },
    token,
  );
}

export async function booksListContacts(
  creds: ZohoCredentials,
  email: string,
  token?: TokenState | null,
) {
  return zohoRequest<{ contacts?: { contact_id?: string; email?: string }[] }>(
    creds,
    { path: "/books/v3/contacts", query: { email }, books: true },
    token,
  );
}

export async function booksCreateInvoice(
  creds: ZohoCredentials,
  invoice: Record<string, unknown>,
  token?: TokenState | null,
) {
  return zohoRequest<{ invoice?: { invoice_id?: string; invoice_number?: string; balance?: number } }>(
    creds,
    { method: "POST", path: "/books/v3/invoices", json: invoice, books: true },
    token,
  );
}

export async function booksEmailInvoice(
  creds: ZohoCredentials,
  invoiceId: string,
  token?: TokenState | null,
) {
  return zohoRequest(
    creds,
    { method: "POST", path: `/books/v3/invoices/${invoiceId}/email`, json: {}, books: true },
    token,
  );
}

export async function booksCreatePayment(
  creds: ZohoCredentials,
  payment: Record<string, unknown>,
  token?: TokenState | null,
) {
  return zohoRequest<{ payment?: { payment_id?: string } }>(
    creds,
    { method: "POST", path: "/books/v3/customerpayments", json: payment, books: true },
    token,
  );
}

export async function booksListTaxes(creds: ZohoCredentials, token?: TokenState | null) {
  return zohoRequest<{ taxes?: { tax_id?: string; tax_percentage?: number; tax_name?: string }[] }>(
    creds,
    { path: "/books/v3/settings/taxes", books: true },
    token,
  );
}

export async function booksOrganization(creds: ZohoCredentials, token?: TokenState | null) {
  return zohoRequest<{
    organization?: {
      name?: string;
      tax_id?: string;
      country?: string;
      is_registered_for_tax?: boolean;
    };
  }>(creds, { path: "/books/v3/organizations", books: true }, token);
}
