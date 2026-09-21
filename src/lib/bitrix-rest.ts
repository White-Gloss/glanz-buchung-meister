import { BitrixError, type BitrixCall } from "./bitrix-error.ts";

const WEBHOOK_RE =
  /^https:\/\/([a-z0-9-]+)\.bitrix24\.(de|com|eu|ru)\/rest\/(\d+)\/([a-zA-Z0-9]+)(?:\/.*)?$/i;

const UF: Record<string, string> = {
  ufCrmWgPhotos: "UF_CRM_WG_PHOTOS",
  ufCrmWgVehicle: "UF_CRM_WG_VEHICLE",
  ufCrmWgPackage: "UF_CRM_WG_PACKAGE",
  ufCrmWgExtras: "UF_CRM_WG_EXTRAS",
  ufCrmWgCity: "UF_CRM_WG_CITY",
  ufCrmWgAppointment: "UF_CRM_WG_APPOINTMENT",
  ufCrmWgPrefDates: "UF_CRM_WG_PREF_DATES",
  ufCrmWgClass: "UF_CRM_WG_CLASS",
};

export function normalizeBitrixRestWebhook(raw: string): string | null {
  const value = raw.trim();
  const match = WEBHOOK_RE.exec(value);
  if (!match) return null;
  const [, sub, tld, userId, code] = match;
  return `https://${sub.toLowerCase()}.bitrix24.${tld.toLowerCase()}/rest/${userId}/${code}/`;
}

type RestJson = {
  result?: unknown;
  error?: string;
  error_description?: string;
};

async function restCall(
  webhook: string,
  method: string,
  params: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const response = await fetchImpl(`${webhook}${method}.json`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(params),
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
  let json: RestJson | null = null;
  try {
    json = text ? (JSON.parse(text) as RestJson) : null;
  } catch {
    throw new BitrixError(
      text.slice(0, 280) || "Ungültige Antwort",
      "bitrix_invalid_json",
      response.status,
      {
        retryable: response.status >= 500,
      },
    );
  }
  if (!json || json.error || !response.ok) {
    throw new BitrixError(
      json?.error_description || json?.error || `Bitrix24-Fehler (${response.status})`,
      json?.error || "bitrix_error",
      response.status,
      { retryable: response.status >= 500 },
    );
  }
  return json.result;
}

function asId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BitrixError("Bitrix hat keine ID geliefert.", "bitrix_invalid_id", 0, {
      review: true,
    });
  }
  return id;
}

function restDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("sv-SE", { timeZone: "Europe/Berlin" });
}

export function toRestDealFields(body: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  if (typeof body.title === "string") fields.TITLE = body.title;
  if (body.contactId != null) fields.CONTACT_ID = body.contactId;
  if (typeof body.stageId === "string") fields.STAGE_ID = body.stageId;
  if (typeof body.typeId === "string") fields.TYPE_ID = body.typeId;
  if (typeof body.sourceId === "string") fields.SOURCE_ID = body.sourceId;
  if (typeof body.currency === "string") fields.CURRENCY_ID = body.currency;
  if (typeof body.amount === "number") fields.OPPORTUNITY = body.amount;
  if (typeof body.comments === "string") fields.COMMENTS = body.comments;
  if (typeof body.begindate === "string") fields.BEGINDATE = restDate(body.begindate);
  if (typeof body.closedAt === "string") fields.CLOSEDATE = restDate(body.closedAt);
  if (typeof body.opened === "boolean") fields.OPENED = body.opened ? "Y" : "N";
  if (typeof body.isManualOpportunity === "boolean")
    fields.IS_MANUAL_OPPORTUNITY = body.isManualOpportunity ? "Y" : "N";
  for (const [key, restName] of Object.entries(UF)) {
    if (body[key] !== undefined) fields[restName] = body[key];
  }
  return fields;
}

export async function probeBitrixRest(
  webhook: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await restCall(webhook, "crm.deal.list", { start: 0, select: ["ID"] }, options.fetchImpl);
    return { ok: true };
  } catch (error) {
    if (
      error instanceof BitrixError &&
      /invalid|access|auth|webhook|credential/i.test(error.message + error.code)
    )
      return { ok: false, error: "Zugang verweigert. Bitte die REST-Webhook-URL prüfen." };
    return { ok: false, error: "Bitrix24 ist gerade nicht erreichbar." };
  }
}

// Universal CRM methods wrap smart invoices (entityTypeId 31) in result.item.
// A successful HTTP response alone does not prove that the intended invoice
// or requested stage was returned. Ambiguous responses require review.
function verifiedInvoiceItem(result: unknown, id: number, stageId?: string) {
  const item =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>).item
      : null;
  const invoice =
    item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : null;
  const returnedId = invoice?.id;
  if (
    !invoice ||
    !(typeof returnedId === "number" ||
      (typeof returnedId === "string" && /^[1-9]\d*$/.test(returnedId))) ||
    Number(returnedId) !== id ||
    (invoice.entityTypeId !== undefined && invoice.entityTypeId !== 31) ||
    typeof invoice.stageId !== "string" ||
    !invoice.stageId.trim() ||
    (stageId !== undefined && invoice.stageId !== stageId)
  ) {
    throw new BitrixError(
      "Bitrix hat den angeforderten Rechnungsstatus nicht eindeutig bestätigt. Rechnung vor Wiederholung prüfen.",
      "bitrix_invoice_unverified",
      0,
      { review: true },
    );
  }
  return invoice;
}

export function createBitrixRestClient(
  webhook: string,
  fetchImpl: typeof fetch = fetch,
): BitrixCall {
  const call = (method: string, params?: Record<string, unknown>) =>
    restCall(webhook, method, params, fetchImpl);

  return async <T>(method: string, path: string, body?: unknown) => {
    const payload = (body || {}) as Record<string, unknown>;
    // Deliberately limited to existing-invoice reads and stage updates.
    // No creation, renumbering, document replacement or payment booking here.
    const invoiceMatch = /^\/invoices\/([1-9]\d*)$/.exec(path);
    if (invoiceMatch && (method === "GET" || method === "PATCH")) {
      const id = Number(invoiceMatch[1]);
      if (!Number.isSafeInteger(id)) {
        throw new BitrixError("Ungültige Rechnungs-ID.", "bitrix_invalid_id", 0, {
          review: true,
        });
      }
      if (method === "GET") {
        return verifiedInvoiceItem(await call("crm.item.get", { entityTypeId: 31, id }), id) as T;
      }
      if (
        !body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(payload).some((key) => key !== "stageId") ||
        typeof payload.stageId !== "string" || !payload.stageId.trim() ||
        payload.stageId !== payload.stageId.trim()
      ) {
        throw new BitrixError(
          "Der Rechnungsabgleich erlaubt ausschließlich einen eindeutigen Statuswechsel.",
          "bitrix_invoice_invalid_update",
          0,
          { review: true },
        );
      }
      const result = await call("crm.item.update", {
        entityTypeId: 31,
        id,
        fields: { stageId: payload.stageId },
      });
      return verifiedInvoiceItem(result, id, payload.stageId) as T;
    }
    if (method === "GET" && path.startsWith("/deals")) {
      return (await call("crm.deal.list", { start: 0, select: ["ID"] })) as T;
    }
    if (method === "POST" && path === "/contacts/search") {
      const filter = (payload.filter || {}) as { email?: string; phone?: string };
      const restFilter: Record<string, string> = {};
      if (filter.email) restFilter.EMAIL = filter.email;
      if (filter.phone) restFilter.PHONE = filter.phone;
      const rows = (await call("crm.contact.list", {
        filter: restFilter,
        select: ["ID"],
      })) as Array<{ ID?: string | number }>;
      return (Array.isArray(rows) ? rows.map((row) => ({ id: asId(row.ID) })) : []) as T;
    }
    if (method === "POST" && path === "/contacts") {
      const id = await call("crm.contact.add", {
        fields: {
          NAME: payload.name,
          LAST_NAME: payload.lastName,
          EMAIL: payload.email ? [{ VALUE: payload.email, VALUE_TYPE: "WORK" }] : undefined,
          PHONE: payload.phone ? [{ VALUE: payload.phone, VALUE_TYPE: "WORK" }] : undefined,
          SOURCE_ID: payload.sourceId || "WEB",
          TYPE_ID: payload.typeId || "CLIENT",
          OPENED: payload.opened ? "Y" : "N",
        },
      });
      return { id: asId(id) } as T;
    }
    if (method === "POST" && path === "/deals") {
      const id = await call("crm.deal.add", { fields: toRestDealFields(payload) });
      return { id: asId(id) } as T;
    }
    if (method === "PATCH" && path.startsWith("/deals/")) {
      const id = Number(path.split("/")[2]);
      await call("crm.deal.update", { id, fields: toRestDealFields(payload) });
      return { ok: true } as T;
    }
    if (method === "PUT" && /^\/deals\/\d+\/products$/.test(path)) {
      const id = Number(path.split("/")[2]);
      const products = (payload.items as Array<Record<string, unknown>>) || [];
      await call("crm.deal.productrows.set", {
        id,
        rows: products.map((item) => ({
          PRODUCT_ID: item.productId,
          PRODUCT_NAME: item.productName,
          PRICE: item.price,
          QUANTITY: item.quantity ?? 1,
          TAX_RATE: item.taxRate ?? 19,
          TAX_INCLUDED: item.taxIncluded ? "Y" : "N",
        })),
      });
      return { ok: true } as T;
    }
    if (method === "DELETE" && /^\/calendar-events\/\d+$/.test(path)) {
      await call("calendar.event.delete", {
        id: Number(path.split("/")[2]),
        type: payload.type || "user",
        ownerId: payload.ownerId || 1,
      });
      return { ok: true } as T;
    }
    if (
      (method === "POST" && path === "/calendar-events") ||
      (method === "PATCH" && /^\/calendar-events\/\d+$/.test(path))
    ) {
      const existingId = method === "PATCH" ? Number(path.split("/")[2]) : null;
      const id = await call(existingId ? "calendar.event.update" : "calendar.event.add", {
        ...(existingId ? { id: existingId } : {}),
        type: payload.type || "user",
        ownerId: payload.ownerId || 1,
        name: payload.name,
        desc: payload.description,
        from: typeof payload.from === "string" ? restDate(payload.from) : payload.from,
        to: typeof payload.to === "string" ? restDate(payload.to) : payload.to,
        location: payload.location,
        section: payload.sectionId,
        timezone_from: "Europe/Berlin",
        timezone_to: "Europe/Berlin",
        accessibility: payload.accessibility,
        crm_fields: payload.crmFields,
      });
      return { id: existingId ?? asId(id) } as T;
    }
    throw new BitrixError(
      `Unbekannte Bitrix-REST-Aktion ${method} ${path}`,
      "bitrix_unsupported",
      0,
      {
        review: true,
      },
    );
  };
}
