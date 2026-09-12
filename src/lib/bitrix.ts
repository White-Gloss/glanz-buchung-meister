import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_BASE = "https://vibecode.bitrix24.com/v1";

function keyFromReleaseOverlay() {
  const candidates = [
    join(process.cwd(), ".output/runtime-vibe.env"),
    join(process.cwd(), "runtime-vibe.env"),
  ];
  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue;
      const line = readFileSync(path, "utf8")
        .split(/\r?\n/)
        .find((entry) => entry.startsWith("VIBE_API_KEY="));
      const value = line?.slice("VIBE_API_KEY=".length).trim() || "";
      if (value) return value;
    } catch {
      /* overlay is optional */
    }
  }
  return "";
}

export function vibeApiKey() {
  return (process.env.VIBE_API_KEY || keyFromReleaseOverlay()).trim();
}

export function vibeApiBase() {
  return (process.env.VIBE_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
}

export class BitrixError extends Error {
  code: string;
  status: number;
  review: boolean;
  retryable: boolean;
  constructor(
    message: string,
    code: string,
    status = 0,
    opts?: { review?: boolean; retryable?: boolean },
  ) {
    super(message);
    this.name = "BitrixError";
    this.code = code;
    this.status = status;
    this.review = opts?.review ?? false;
    this.retryable = opts?.retryable ?? (status === 429 || status >= 500);
  }
}

export type BitrixCall = <T>(method: string, path: string, body?: unknown) => Promise<T>;

type VibeResponse<T> = {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

export function createBitrixClient(apiKey = vibeApiKey(), base = vibeApiBase()): BitrixCall {
  if (!apiKey) {
    throw new BitrixError("Bitrix API-Schlüssel fehlt.", "bitrix_not_configured", 0, {
      review: true,
    });
  }
  return async <T>(method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = {
      "X-Api-Key": apiKey,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    }).catch((error: unknown) => {
      throw new BitrixError(
        error instanceof Error ? error.message : "Bitrix nicht erreichbar",
        "bitrix_network",
        0,
        { retryable: true },
      );
    });
    const text = await response.text();
    let json: VibeResponse<T> | null = null;
    try {
      json = text ? (JSON.parse(text) as VibeResponse<T>) : null;
    } catch {
      throw new BitrixError(text.slice(0, 280) || "Ungültige Antwort", "bitrix_invalid_json", response.status, {
        retryable: response.status >= 500,
      });
    }
    if (!json || json.success === false || !response.ok) {
      throw new BitrixError(
        json?.error?.message || `Bitrix24-Fehler (${response.status})`,
        json?.error?.code || "bitrix_error",
        response.status,
      );
    }
    return json.data as T;
  };
}

export const DEFAULT_PRODUCT_MAP: Record<string, number> = {
  basis: 2,
  premium: 4,
  keramik: 6,
  leder: 8,
  "leder-repair": 10,
  ozon: 12,
  hol20: 16,
  hol50: 18,
  felgen: 20,
  motor: 22,
  alcantara: 24,
  dachhimmel: 26,
  scheinwerfer: 28,
  glas: 30,
  "keramik-ultra": 32,
  cabrio: 34,
  tierhaar: 36,
  "stoff-loch": 38,
};

export function productMapFromEnv(raw = process.env.VIBE_PRODUCT_MAP): Record<string, number> {
  const map = { ...DEFAULT_PRODUCT_MAP };
  const text = (raw || "").trim();
  if (!text) return map;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(value);
      if (Number.isInteger(id) && id > 0) map[key] = id;
    }
  } catch {
    /* keep defaults when the override is not valid JSON */
  }
  return map;
}
