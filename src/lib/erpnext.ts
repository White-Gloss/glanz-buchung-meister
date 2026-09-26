import { EMBEDDED_ERPNEXT } from "./erpnext.generated.ts";
import {
  ERPNEXT_ALLOWED_HOSTS,
  ERPNEXT_COMPANY,
  ERPNEXT_DEFAULT_BASE_URL,
} from "./erpnext-site.ts";

export { ERPNEXT_COMPANY, ERPNEXT_DEFAULT_BASE_URL };


export type ErpnextCredentials = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
};

export type ErpnextProbe = {
  ok: boolean;
  user: string | null;
  companyFound: boolean;
  status: number | null;
  error: string | null;
};

function trimEnv(key: string): string {
  return (process.env[key] || "").trim();
}

export function normalizeErpnextBaseUrl(raw: string | null | undefined): string | null {
  const value = (raw || "").trim().replace(/\/+$/, "");
  if (!value) return ERPNEXT_DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!ERPNEXT_ALLOWED_HOSTS.has(url.hostname)) return null;
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname}`.replace(/\/+$/, "");
}

export function writesEnabled(flag: string | undefined): boolean {
  return (flag || "").trim() === "true";
}

export function sanitizeErpnextError(message: string): string {
  return message
    .replace(/token\s+\S+/gi, "token [redacted]")
    .replace(/api[_-]?secret[=:]\s*\S+/gi, "api_secret=[redacted]")
    .replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=[redacted]");
}

export function credentialsFromEnv(embed = EMBEDDED_ERPNEXT): ErpnextCredentials | null {
  const apiKey = trimEnv("ERPNEXT_API_KEY") || embed?.apiKey || "";
  const apiSecret = trimEnv("ERPNEXT_API_SECRET") || embed?.apiSecret || "";
  const baseUrl = normalizeErpnextBaseUrl(
    trimEnv("ERPNEXT_BASE_URL") || embed?.baseUrl || ERPNEXT_DEFAULT_BASE_URL,
  );
  if (!apiKey || !apiSecret || !baseUrl) return null;
  return { baseUrl, apiKey, apiSecret };
}

function messageFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

export async function probeErpnext(
  creds: ErpnextCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<ErpnextProbe> {
  const headers = {
    Authorization: `token ${creds.apiKey}:${creds.apiSecret}`,
    Accept: "application/json",
  };

  const getJson = async (path: string) => {
    const response = await fetchImpl(`${creds.baseUrl}${path}`, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    let payload: unknown = null;
    if (contentType.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }
    }
    return { response, payload, contentType };
  };

  try {
    const auth = await getJson("/api/method/frappe.auth.get_logged_user");
    if (!auth.response.ok || !auth.payload) {
      return {
        ok: false,
        user: null,
        companyFound: false,
        status: auth.response.status,
        error: "erpnext_auth_failed",
      };
    }
    const user = messageFromPayload(auth.payload);
    if (!user) {
      return {
        ok: false,
        user: null,
        companyFound: false,
        status: auth.response.status,
        error: "erpnext_auth_failed",
      };
    }

    const company = await getJson(`/api/resource/Company/${encodeURIComponent(ERPNEXT_COMPANY)}`);
    const companyFound = Boolean(
      company.response.ok &&
        company.payload &&
        typeof company.payload === "object" &&
        (company.payload as { data?: { name?: string } }).data?.name === ERPNEXT_COMPANY,
    );

    return {
      ok: companyFound,
      user,
      companyFound,
      status: company.response.status,
      error: companyFound ? null : "erpnext_company_missing",
    };
  } catch (err) {
    return {
      ok: false,
      user: null,
      companyFound: false,
      status: null,
      error: sanitizeErpnextError(err instanceof Error ? err.message : "erpnext_unreachable"),
    };
  }
}
