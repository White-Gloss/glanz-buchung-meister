/** Lexware Office Public API HTTP client (https://api.lexware.io/v1). */

export const LEXWARE_DEFAULT_API_BASE = "https://api.lexware.io/v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LexwareCredentials = {
  apiKey: string;
  apiBase: string;
};

export class LexwareError extends Error {
  code: string;
  status: number | null;
  retryable: boolean;
  review: boolean;
  constructor(
    code: string,
    options: {
      status?: number | null;
      retryable?: boolean;
      review?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(code);
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = Boolean(options.retryable);
    this.review = Boolean(options.review);
    if (options.cause !== undefined) (this as Error & { cause?: unknown }).cause = options.cause;
  }
}

function trimEnv(key: string): string {
  return (process.env[key] || "").trim();
}

export function normalizeLexwareApiBase(raw: string | null | undefined): string {
  const value = (raw || "").trim().replace(/\/+$/, "") || LEXWARE_DEFAULT_API_BASE;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LexwareError("lexware_invalid_api_base", { review: true });
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new LexwareError("lexware_invalid_api_base", { review: true });
  if (url.search || url.hash) throw new LexwareError("lexware_invalid_api_base", { review: true });
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function lexwareCredentialsFromEnv(): LexwareCredentials | null {
  const apiKey = trimEnv("LEXWARE_API_KEY");
  if (!apiKey) return null;
  return {
    apiKey,
    apiBase: normalizeLexwareApiBase(trimEnv("LEXWARE_API_BASE") || LEXWARE_DEFAULT_API_BASE),
  };
}

export function extractLexwareId(payload: unknown): string | null {
  if (typeof payload === "string" && UUID_RE.test(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  if (typeof row.id === "string" && UUID_RE.test(row.id)) return row.id;
  return null;
}

export function extractLexwareContacts(payload: unknown): Record<string, unknown>[] {
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { content?: unknown }).content)
  )
    return (payload as { content: Record<string, unknown>[] }).content;
  return [];
}

export type LexwareRequest = <T>(
  method: string,
  path: string,
  body?: Record<string, unknown> | null,
  query?: Record<string, string | string[] | undefined>,
) => Promise<T>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildQuery(query?: Record<string, string | string[] | undefined>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.append(key, value);
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function createLexwareClient(
  creds: LexwareCredentials,
  options: {
    fetchImpl?: typeof fetch;
    minIntervalMs?: number;
    maxRetries?: number;
    now?: () => number;
    sleepImpl?: (ms: number) => Promise<void>;
  } = {},
): LexwareRequest {
  const fetchImpl = options.fetchImpl || fetch;
  const minIntervalMs = options.minIntervalMs ?? 520;
  const maxRetries = options.maxRetries ?? 4;
  const now = options.now || Date.now;
  const sleepImpl = options.sleepImpl || sleep;
  let lastAt = 0;

  return async <T>(
    method: string,
    path: string,
    body: Record<string, unknown> | null = null,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<T> => {
    const url = `${creds.apiBase}${path.startsWith("/") ? path : `/${path}`}${buildQuery(query)}`;
    let attempt = 0;
    while (true) {
      const wait = minIntervalMs - (now() - lastAt);
      if (wait > 0) await sleepImpl(wait);
      lastAt = now();
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${creds.apiKey}`,
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (cause) {
        throw new LexwareError("lexware_unreachable", { retryable: true, cause });
      }
      const text = await response.text();
      let payload: unknown = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
      if (response.status === 429) {
        if (attempt >= maxRetries)
          throw new LexwareError("lexware_rate_limited", { status: 429, retryable: true });
        attempt++;
        await sleepImpl(Math.min(8_000, 500 * 2 ** attempt));
        continue;
      }
      if (response.status === 401 || response.status === 403)
        throw new LexwareError("lexware_access_denied", { status: response.status, review: true });
      if (response.status === 422 || response.status === 406)
        throw new LexwareError("lexware_validation_failed", {
          status: response.status,
          review: true,
        });
      if (!response.ok)
        throw new LexwareError("lexware_request_failed", {
          status: response.status,
          retryable: response.status >= 500,
        });
      return payload as T;
    }
  };
}

export async function findContactByEmail(
  request: LexwareRequest,
  email: string | null | undefined,
): Promise<string | null> {
  const value = (email || "").trim();
  if (value.length < 3) return null;
  const payload = await request<unknown>("GET", "/contacts", null, {
    email: value,
    customer: "true",
  });
  const list = extractLexwareContacts(payload);
  for (const row of list) {
    if (row.archived === true) continue;
    const id = extractLexwareId(row);
    if (id) return id;
  }
  return null;
}

export async function createContact(
  request: LexwareRequest,
  input: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    note?: string;
  },
): Promise<string> {
  const lastName = input.lastName.trim();
  if (!lastName) throw new LexwareError("lexware_missing_name", { review: true });
  const payload = await request<unknown>("POST", "/contacts", {
    version: 0,
    roles: { customer: {} },
    person: {
      firstName: input.firstName.trim() || "Kunde",
      lastName,
    },
    ...(input.email ? { emailAddresses: { business: [input.email] } } : {}),
    ...(input.phone ? { phoneNumbers: { mobile: [input.phone] } } : {}),
    ...(input.note ? { note: input.note } : {}),
  });
  const id = extractLexwareId(payload);
  if (!id) throw new LexwareError("lexware_create_needs_review", { review: true });
  return id;
}

export type LexwareInvoiceLine = {
  type: "custom";
  name: string;
  description?: string;
  quantity: number;
  unitName: string;
  unitPrice: {
    currency: "EUR";
    netAmount: number;
    taxRatePercentage: number;
  };
};

export async function createInvoiceDraft(
  request: LexwareRequest,
  input: {
    voucherDate: string;
    contactId: string;
    addressName: string;
    lineItems: LexwareInvoiceLine[];
    shippingDate: string;
    title?: string;
    introduction?: string;
    remark: string;
  },
): Promise<string> {
  const payload = await request<unknown>("POST", "/invoices", {
    voucherDate: input.voucherDate,
    contactId: input.contactId,
    address: {
      name: input.addressName,
      countryCode: "DE",
    },
    lineItems: input.lineItems,
    totalPrice: { currency: "EUR" },
    taxConditions: { taxType: "net" },
    shippingConditions: {
      shippingDate: input.shippingDate,
      shippingType: "service",
    },
    title: input.title || "Rechnung",
    introduction: input.introduction,
    remark: input.remark,
  });
  const id = extractLexwareId(payload);
  if (!id) throw new LexwareError("lexware_create_needs_review", { review: true });
  return id;
}
