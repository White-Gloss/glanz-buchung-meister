/** RO App Public API v2 HTTP client (https://api.roapp.io/v2). */

export const ROAPP_DEFAULT_API_BASE = "https://api.roapp.io/v2";

export type RoappCredentials = {
  apiKey: string;
  apiBase: string;
  branchId: number;
  assigneeId: number;
  orderTypeId: number;
  entityMap: Record<string, number>;
  expectedCompanyCreatedAt?: string;
};

export class RoappError extends Error {
  code: string;
  status: number | null;
  retryable: boolean;
  review: boolean;
  /** Normalized write step, e.g. "POST /orders/:id/items" (no ids, no data). */
  operation?: string;
  /** RO's rejection reason without contact data, e.g. "Felder: phones". */
  detail?: string;
  constructor(
    code: string,
    options: {
      status?: number | null;
      retryable?: boolean;
      review?: boolean;
      cause?: unknown;
      detail?: string;
    } = {},
  ) {
    super(code);
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = Boolean(options.retryable);
    this.review = Boolean(options.review);
    if (options.detail) this.detail = options.detail;
    if (options.cause !== undefined) (this as Error & { cause?: unknown }).cause = options.cause;
  }
}

/** Field names and message of an RO error response. E-mail addresses and digit
 * runs (phone numbers, ids) are masked, so no contact data leaves RO's answer. */
export function roappErrorDetail(payload: unknown): string | undefined {
  let text = "";
  if (typeof payload === "string") text = payload;
  else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const row = payload as Record<string, unknown>;
    const errors = row.errors;
    const fields =
      errors && typeof errors === "object" && !Array.isArray(errors) ? Object.keys(errors) : [];
    const message = [row.message, row.error, row.detail].find(
      (value): value is string => typeof value === "string",
    );
    text = [fields.length ? `Felder: ${fields.join(", ")}` : "", message || ""]
      .filter(Boolean)
      .join(" · ");
  }
  const safe = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\S+@\S+/g, "…")
    .replace(/\+?\d[\d\s/().-]{2,}\d/g, "…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return safe || undefined;
}

function trimEnv(key: string): string {
  return (process.env[key] || "").trim();
}

function parsePositiveInt(raw: string, label: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new RoappError(`roapp_invalid_${label}`, { review: true });
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
  if (
    url.origin !== "https://api.roapp.io" ||
    url.pathname !== "/v2" ||
    url.username ||
    url.password
  )
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
    expectedCompanyCreatedAt: trimEnv("ROAPP_EXPECTED_COMPANY_CREATED_AT") || undefined,
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
  if (Array.isArray(row.data) && row.data[0]) return extractRoappId(row.data[0]);
  if (row.data && typeof row.data === "object") return extractRoappId(row.data);
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
    timeoutMs?: number;
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

  const transport: RoappRequest = async <T>(
    method: string,
    path: string,
    body: Record<string, unknown> | null = null,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<T> => {
    const readOnly = method === "GET" || method === "HEAD";
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
          redirect: "error",
          headers: {
            Authorization: `Bearer ${creds.apiKey}`,
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
        });
      } catch (cause) {
        // A lost response can follow a successful write. Never blindly recreate it.
        throw new RoappError("roapp_unreachable", {
          retryable: readOnly,
          review: !readOnly,
          cause,
        });
      }
      let text: string;
      try {
        text = await response.text();
      } catch (cause) {
        throw new RoappError("roapp_response_lost", {
          retryable: readOnly,
          review: !readOnly,
          cause,
        });
      }
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
        throw new RoappError("roapp_access_denied", {
          status: response.status,
          review: true,
          detail: roappErrorDetail(payload),
        });
      if (!response.ok)
        throw new RoappError("roapp_request_failed", {
          status: response.status,
          retryable: readOnly && response.status >= 500,
          review: !readOnly || response.status < 500,
          detail: roappErrorDetail(payload),
        });
      return payload as T;
    }
  };
  let verified: Promise<void> | undefined;
  return async <T>(
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
    query?: Record<string, string | string[] | undefined>,
  ) => {
    // Environment clients require an account fingerprint even for reads: foreign
    // order ids could otherwise overwrite the local customer's status/price.
    if (!creds.expectedCompanyCreatedAt)
      throw new RoappError("roapp_account_identity_missing", { review: true });
    verified ??= transport<{ created_at?: string }>("GET", "/company")
      .then((company) => {
        if (company.created_at !== creds.expectedCompanyCreatedAt)
          throw new RoappError("roapp_account_identity_mismatch", { review: true });
      })
      .catch((error) => {
        verified = undefined;
        throw error;
      });
    await verified;
    return transport<T>(method, path, body, query);
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
  _phone: string,
  email: string | null | undefined,
): Promise<number | null> {
  // Email identifies this website customer. A shared household phone must not
  // attach private order details to a different person's record.
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return null;
  const payload = await request<unknown>("GET", "/contacts/people", null, {
    emails: [normalizedEmail],
    page: "1",
  });
  const rows = extractRoappList(payload);
  const paging = (payload as { paging?: { total_pages?: number } })?.paging;
  if (paging && paging.total_pages !== undefined && paging.total_pages > 1)
    throw new RoappError("roapp_contact_ambiguous", { review: true });
  const matches = rows.filter(
    (row) => typeof row.email === "string" && row.email.trim().toLowerCase() === normalizedEmail,
  );
  if (matches.length > 1) throw new RoappError("roapp_contact_ambiguous", { review: true });
  const match = matches[0];
  if (!match) return null;
  const id = extractRoappId(match);
  if (!id) throw new RoappError("roapp_contact_invalid", { review: true });
  return id;
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
      notify: false,
      has_viber: false,
      has_whatsapp: false,
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
    malfunction?: string;
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
    ...(input.malfunction ? { malfunction: input.malfunction } : {}),
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
    is_private: true,
  });
}

export type RoappPerson = {
  id: number;
  name: string | null;
  email: string | null;
  address: string | null;
};

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new RoappError("roapp_contact_invalid", { review: true });
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length > max) throw new RoappError("roapp_contact_invalid", { review: true });
  return text || null;
}

/** Current contact data from RO. Returns null if this API revision offers no
 * single-contact read, so callers keep the website data instead of guessing. */
export async function getPerson(request: RoappRequest, id: number): Promise<RoappPerson | null> {
  let payload: unknown;
  try {
    payload = await request<unknown>("GET", `/contacts/people/${id}`);
  } catch (error) {
    if (error instanceof RoappError && (error.status === 404 || error.status === 405)) return null;
    throw error;
  }
  const row = (
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload
  ) as Record<string, unknown> | null;
  if (!row || typeof row !== "object" || Array.isArray(row) || row.id !== id)
    throw new RoappError("roapp_contact_invalid", { review: true });
  const email = optionalText(row.email, 254)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new RoappError("roapp_contact_invalid", { review: true });
  const name = [optionalText(row.first_name, 120), optionalText(row.last_name, 120)]
    .filter(Boolean)
    .join(" ");
  const address =
    typeof row.address === "object" && row.address !== null ? null : optionalText(row.address, 500);
  return { id, name: name || null, email, address };
}

export type RoappOrderLine = { name: string; quantity: number; grossCents: number };

function moneyCents(value: unknown): number {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d+(\.\d{1,2})?$/.test(text.trim()))
    throw new RoappError("roapp_items_invalid", { review: true });
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents) || cents > 100_000_000)
    throw new RoappError("roapp_items_invalid", { review: true });
  return cents;
}

/** Parses order positions strictly. Discounts or unknown shapes are never
 * interpreted: the caller compares the sum with RO's canonical total. */
export function parseRoappOrderLines(payload: unknown): RoappOrderLine[] {
  const rows = extractRoappList(payload);
  if (!rows.length || rows.length > 100)
    throw new RoappError("roapp_items_invalid", { review: true });
  return rows.map((row) => {
    const entity =
      row.entity && typeof row.entity === "object" ? (row.entity as Record<string, unknown>) : {};
    const name = [row.title, row.name, entity.title, entity.name, row.comment].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    const quantity = typeof row.quantity === "string" ? Number(row.quantity) : row.quantity;
    if (
      !name ||
      name.length > 300 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > 1000
    )
      throw new RoappError("roapp_items_invalid", { review: true });
    const discount =
      row.discount && typeof row.discount === "object"
        ? (row.discount as Record<string, unknown>)
        : null;
    if (
      discount &&
      [discount.amount, discount.percentage, discount.value].some(
        (value) => value !== undefined && value !== null && Number(value) !== 0,
      )
    )
      throw new RoappError("roapp_items_discount", { review: true });
    const unit = moneyCents(row.price);
    return { name: name.trim(), quantity, grossCents: unit * quantity };
  });
}

export async function getOrderLines(
  request: RoappRequest,
  orderId: number,
): Promise<RoappOrderLine[]> {
  return parseRoappOrderLines(await request<unknown>("GET", `/orders/${orderId}/items`));
}
