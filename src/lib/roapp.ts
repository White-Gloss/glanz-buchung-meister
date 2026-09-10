/** RO App Public API v2 HTTP client (https://api.roapp.io/v2). */

export const ROAPP_DEFAULT_API_BASE = "https://api.roapp.io/v2";

export type RoappCredentials = {
  apiKey: string;
  apiBase: string;
  branchId: number;
  assigneeId: number;
  orderTypeId: number;
  entityMap: Record<string, number>;
};

export class RoappError extends Error {
  code: string;
  status: number | null;
  retryable: boolean;
  review: boolean;
  constructor(
    code: string,
    options: { status?: number | null; retryable?: boolean; review?: boolean; cause?: unknown } = {},
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

function parsePositiveInt(raw: string, label: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) throw new RoappError(`roapp_invalid_${label}`, { review: true });
  return n;
}

export function parseRoappEntityMap(raw: string): Record<string, number> {
  const value = raw.trim();
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new RoappError("roapp_invalid_entity_map", { review: true });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new RoappError("roapp_invalid_entity_map", { review: true });
  const out: Record<string, number> = {};
  for (const [key, id] of Object.entries(parsed as Record<string, unknown>)) {
    const n = typeof id === "number" ? id : typeof id === "string" ? Number(id) : NaN;
    if (!key || !Number.isSafeInteger(n) || n <= 0)
      throw new RoappError("roapp_invalid_entity_map", { review: true });
    out[key] = n;
  }
  return out;
}

export function normalizeRoappApiBase(raw: string | null | undefined): string {
  const value = (raw || "").trim().replace(/\/+$/, "") || ROAPP_DEFAULT_API_BASE;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RoappError("roapp_invalid_api_base", { review: true });
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new RoappError("roapp_invalid_api_base", { review: true });
  if (url.search || url.hash) throw new RoappError("roapp_invalid_api_base", { review: true });
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function roappCredentialsFromEnv(): RoappCredentials | null {
  const apiKey = trimEnv("ROAPP_API_KEY");
  if (!apiKey) return null;
  const branchId = parsePositiveInt(trimEnv("ROAPP_BRANCH_ID"), "branch_id");
  const assigneeId = parsePositiveInt(trimEnv("ROAPP_ASSIGNEE_ID"), "assignee_id");
  const orderTypeId = parsePositiveInt(trimEnv("ROAPP_ORDER_TYPE_ID"), "order_type_id");
  if (!branchId || !assigneeId || !orderTypeId) return null;
  return {
    apiKey,
    apiBase: normalizeRoappApiBase(trimEnv("ROAPP_API_BASE") || ROAPP_DEFAULT_API_BASE),
    branchId,
    assigneeId,
    orderTypeId,
    entityMap: parseRoappEntityMap(trimEnv("ROAPP_ENTITY_MAP")),
  };
}

export function extractRoappId(payload: unknown): number | null {
  if (typeof payload === "number" && Number.isSafeInteger(payload) && payload > 0) return payload;
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  for (const key of ["id", "person_id", "booking_id", "order_id"]) {
    const value = row[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  }
  if (row.data && typeof row.data === "object") return extractRoappId(row.data);
  if (Array.isArray(row.data) && row.data[0]) return extractRoappId(row.data[0]);
  return null;
}

export function extractRoappList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const row = payload as Record<string, unknown>;
    if (Array.isArray(row.data)) return row.data as Record<string, unknown>[];
    if (Array.isArray(row.items)) return row.items as Record<string, unknown>[];
    if (Array.isArray(row.people)) return row.people as Record<string, unknown>[];
  }
  return [];
}

export type RoappRequest = <T>(
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

export function createRoappClient(
  creds: RoappCredentials,
  options: {
    fetchImpl?: typeof fetch;
    minIntervalMs?: number;
    maxRetries?: number;
    now?: () => number;
    sleepImpl?: (ms: number) => Promise<void>;
  } = {},
): RoappRequest {
  const fetchImpl = options.fetchImpl || fetch;
  const minIntervalMs = options.minIntervalMs ?? 340;
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
        throw new RoappError("roapp_unreachable", { retryable: true, cause });
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
          throw new RoappError("roapp_rate_limited", { status: 429, retryable: true });
        attempt++;
        await sleepImpl(Math.min(8_000, 500 * 2 ** attempt));
        continue;
      }
      if (response.status === 401 || response.status === 403)
        throw new RoappError("roapp_access_denied", { status: response.status, review: true });
      if (!response.ok)
        throw new RoappError("roapp_request_failed", {
          status: response.status,
          retryable: response.status >= 500,
        });
      return payload as T;
    }
  };
}

export type RoappPersonPhone = {
  title: string;
  phone: string;
  notify: boolean;
  has_viber: boolean;
  has_whatsapp: boolean;
};

export async function findPersonByPhoneOrEmail(
  request: RoappRequest,
  phone: string,
  email: string | null | undefined,
): Promise<number | null> {
  const queries: Array<Record<string, string | string[] | undefined>> = [];
  if (phone) queries.push({ phones: [phone], page: "1" });
  if (email) queries.push({ emails: [email], page: "1" });
  for (const query of queries) {
    const payload = await request<unknown>("GET", "/contacts/people", null, query);
    const list = extractRoappList(payload);
    const id = list[0] ? extractRoappId(list[0]) : null;
    if (id) return id;
  }
  return null;
}

export async function createPerson(
  request: RoappRequest,
  input: {
    firstName: string;
    lastName?: string;
    email?: string | null;
    phone: string;
    notes?: string;
  },
): Promise<number> {
  const phones: RoappPersonPhone[] = [
    {
      title: "Mobil",
      phone: input.phone,
      notify: true,
      has_viber: false,
      has_whatsapp: true,
    },
  ];
  const payload = await request<unknown>("POST", "/contacts/people", {
    first_name: input.firstName,
    ...(input.lastName ? { last_name: input.lastName } : {}),
    ...(input.email ? { email: input.email } : {}),
    phones,
    ...(input.notes ? { notes: input.notes } : {}),
  });
  const id = extractRoappId(payload);
  if (!id) throw new RoappError("roapp_create_needs_review", { review: true });
  return id;
}

export async function createBooking(
  request: RoappRequest,
  input: {
    branchId: number;
    assigneeId: number;
    clientId: number;
    scheduledFor: string;
    scheduledTo: string;
    comment: string;
  },
): Promise<number> {
  const payload = await request<unknown>("POST", "/bookings", {
    branch_id: input.branchId,
    assignee_id: input.assigneeId,
    client_id: input.clientId,
    scheduled_for: input.scheduledFor,
    scheduled_to: input.scheduledTo,
    comment: input.comment,
  });
  const id = extractRoappId(payload);
  if (!id) throw new RoappError("roapp_create_needs_review", { review: true });
  return id;
}

export async function addBookingItem(
  request: RoappRequest,
  bookingId: number,
  input: { entityId: number; quantity: number; price?: number; comment?: string },
): Promise<void> {
  await request("POST", `/bookings/${bookingId}/items`, {
    entity_id: input.entityId,
    quantity: input.quantity,
    ...(input.price !== undefined ? { price: input.price } : {}),
    ...(input.comment ? { comment: input.comment } : {}),
  });
}

export async function createOrder(
  request: RoappRequest,
  input: {
    branchId: number;
    orderTypeId: number;
    clientId: number;
    assigneeId?: number;
    managerNotes?: string;
    estimatedPrice?: string;
    scheduledFor?: string;
    scheduledTo?: string;
  },
): Promise<number> {
  const payload = await request<unknown>("POST", "/orders", {
    branch_id: input.branchId,
    order_type_id: input.orderTypeId,
    client_id: input.clientId,
    ...(input.assigneeId ? { assignee_id: input.assigneeId } : {}),
    ...(input.managerNotes ? { manager_notes: input.managerNotes } : {}),
    ...(input.estimatedPrice ? { estimated_price: input.estimatedPrice } : {}),
    ...(input.scheduledFor ? { scheduled_for: input.scheduledFor } : {}),
    ...(input.scheduledTo ? { scheduled_to: input.scheduledTo } : {}),
  });
  const id = extractRoappId(payload);
  if (!id) throw new RoappError("roapp_create_needs_review", { review: true });
  return id;
}

export async function addOrderItem(
  request: RoappRequest,
  orderId: number,
  input: {
    entityId: number;
    assigneeId: number;
    quantity: number;
    price: number;
    cost?: number;
    comment?: string;
  },
): Promise<void> {
  await request("POST", `/orders/${orderId}/items`, {
    entity_id: input.entityId,
    assignee_id: input.assigneeId,
    quantity: input.quantity,
    price: input.price,
    cost: input.cost ?? 0,
    discount: { type: "percentage", percentage: 0, amount: 0, sponsor: "staff" },
    warranty: { period: "0", periodUnits: "days" },
    ...(input.comment ? { comment: input.comment } : {}),
  });
}

export async function createOrderComment(
  request: RoappRequest,
  orderId: number,
  comment: string,
): Promise<void> {
  await request("POST", `/orders/${orderId}/comments`, {
    comment,
    is_private: false,
  });
}
