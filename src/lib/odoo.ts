import { EMBEDDED_ODOO } from "./odoo.generated.ts";
import { ODOO_ALLOWED_HOSTS, ODOO_DEFAULT_BASE_URL, ODOO_DEFAULT_DATABASE } from "./odoo-site.ts";

export { ODOO_DEFAULT_BASE_URL, ODOO_DEFAULT_DATABASE };

export type OdooCredentials = {
  baseUrl: string;
  database: string;
  apiKey: string;
};

export type OdooProbe = {
  ok: boolean;
  uid: number | null;
  language: string | null;
  timezone: string | null;
  status: number | null;
  error: string | null;
};

function trimEnv(key: string): string {
  return (process.env[key] || "").trim();
}

export function normalizeOdooBaseUrl(raw: string | null | undefined): string | null {
  const value = (raw || "").trim().replace(/\/+$/, "");
  if (!value) return ODOO_DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (
    !ODOO_ALLOWED_HOSTS.has(url.hostname) ||
    url.port ||
    url.search ||
    url.hash ||
    (url.pathname && url.pathname !== "/")
  )
    return null;
  return url.origin;
}

export function odooWritesEnabled(flag: string | undefined): boolean {
  return (flag || "").trim() === "true";
}

export function sanitizeOdooError(message: string): string {
  return message
    .replace(/bearer\s+\S+/gi, "bearer [redacted]")
    .replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=[redacted]");
}

export function odooCredentialsFromEnv(embed = EMBEDDED_ODOO): OdooCredentials | null {
  const apiKey = trimEnv("ODOO_API_KEY") || embed?.apiKey || "";
  const baseUrl = normalizeOdooBaseUrl(
    trimEnv("ODOO_BASE_URL") || embed?.baseUrl || ODOO_DEFAULT_BASE_URL,
  );
  const database = trimEnv("ODOO_DATABASE") || embed?.database || ODOO_DEFAULT_DATABASE;
  if (!apiKey || !baseUrl || !database) return null;
  return { baseUrl, database, apiKey };
}

export async function odooJson2<T>(
  creds: OdooCredentials,
  model: string,
  method: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ response: Response; payload: T | null }> {
  const response = await fetchImpl(
    `${creds.baseUrl}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Odoo-Database": creds.database,
      },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    },
  );
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let payload: T | null = null;
  if (contentType.includes("application/json")) {
    try {
      payload = text ? (JSON.parse(text) as T) : null;
    } catch {
      payload = null;
    }
  }
  return { response, payload };
}

export async function probeOdoo(
  creds: OdooCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<OdooProbe> {
  try {
    const result = await odooJson2<Record<string, unknown>>(
      creds,
      "res.users",
      "context_get",
      {},
      fetchImpl,
    );
    const uid = typeof result.payload?.uid === "number" ? result.payload.uid : null;
    if (!result.response.ok || uid === null) {
      return {
        ok: false,
        uid: null,
        language: null,
        timezone: null,
        status: result.response.status,
        error: result.response.status === 401 ? "odoo_auth_failed" : "odoo_invalid_response",
      };
    }
    return {
      ok: true,
      uid,
      language: typeof result.payload?.lang === "string" ? result.payload.lang : null,
      timezone: typeof result.payload?.tz === "string" ? result.payload.tz : null,
      status: result.response.status,
      error: null,
    };
  } catch {
    return {
      ok: false,
      uid: null,
      language: null,
      timezone: null,
      status: null,
      error: "odoo_unreachable",
    };
  }
}
