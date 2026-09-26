const DEFAULT_BASE = "https://thirdparty.qonto.com/v2";

export type QontoInvoiceLine = {
  title: string;
  quantity: string;
  unit_price: { value: string; currency: string };
  vat_rate: string;
  unit?: string;
  description?: string;
};

export type QontoInvoiceCreateInput = {
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  iban: string;
  items: QontoInvoiceLine[];
};

function qontoBaseUrl(): string {
  const raw = (process.env.QONTO_API_BASE || DEFAULT_BASE).trim();
  return raw.replace(/\/+$/, "");
}

export function qontoConfigured(): boolean {
  const login = (process.env.QONTO_LOGIN || "").trim();
  const secret = (process.env.QONTO_SECRET_KEY || "").trim();
  const iban = (process.env.QONTO_IBAN || "").trim();
  return login.length > 0 && secret.length > 0 && iban.length > 0;
}

/** Authorization value: `${QONTO_LOGIN}:${QONTO_SECRET_KEY}` (no Bearer, no base64). */
export function qontoAuthHeader(): string {
  const login = (process.env.QONTO_LOGIN || "").trim();
  const secret = (process.env.QONTO_SECRET_KEY || "").trim();
  if (!login || !secret) {
    throw new Error("Qonto ist nicht konfiguriert (QONTO_LOGIN / QONTO_SECRET_KEY).");
  }
  return `${login}:${secret}`;
}

function qontoHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: qontoAuthHeader(),
    "Content-Type": "application/json",
  };
  const staging = (process.env.QONTO_STAGING_TOKEN || "").trim();
  if (staging) headers["X-Qonto-Staging-Token"] = staging;
  return headers;
}

async function qontoFetch<T>(
  path: string,
  init: RequestInit & { okStatuses?: number[] } = {},
): Promise<T> {
  const { okStatuses = [200, 201, 204], ...rest } = init;
  const url = `${qontoBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...rest,
    headers: { ...qontoHeaders(), ...(rest.headers || {}) },
  });
  if (!okStatuses.includes(response.status)) {
    const detail = await response.text().catch(() => "");
    console.error("[qonto-mail]", response.status, detail.slice(0, 300));
    throw new Error("Qonto-Anfrage ist fehlgeschlagen.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function splitPersonName(name: string): { first_name: string; last_name: string } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { first_name: trimmed || "Kunde", last_name: trimmed || "White Gloss" };
  }
  return {
    first_name: trimmed.slice(0, space).slice(0, 60),
    last_name: trimmed.slice(space + 1).slice(0, 60) || trimmed.slice(0, 60),
  };
}

export async function findOrCreateQontoClient(input: {
  name: string;
  email: string;
  currency?: "EUR";
}): Promise<{ id: string }> {
  if (!qontoConfigured()) {
    throw new Error("Qonto ist nicht konfiguriert (QONTO_LOGIN / QONTO_SECRET_KEY / QONTO_IBAN).");
  }
  const email = input.email.trim();
  const currency = input.currency ?? "EUR";
  const params = new URLSearchParams({ "filter[email]": email });
  const listed = await qontoFetch<{ clients?: Array<{ id: string; email?: string }> }>(
    `/clients?${params.toString()}`,
    { method: "GET" },
  );
  const existing = (listed.clients || []).find(
    (c) => (c.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (existing?.id) return { id: existing.id };

  const person = splitPersonName(input.name);
  const created = await qontoFetch<{ client: { id: string } }>("/clients", {
    method: "POST",
    body: JSON.stringify({
      kind: "individual",
      first_name: person.first_name,
      last_name: person.last_name,
      email,
      currency,
      locale: "de",
      billing_address: {
        street_address: "Adresse auf Anfrage",
        city: "Horb am Neckar",
        zip_code: "72160",
        country_code: "DE",
      },
    }),
  });
  if (!created.client?.id) {
    throw new Error("Qonto-Kunde konnte nicht angelegt werden.");
  }
  return { id: created.client.id };
}

export async function createAndFinalizeClientInvoice(
  input: QontoInvoiceCreateInput,
): Promise<{ id: string; invoice_number: string; status: string }> {
  if (!qontoConfigured()) {
    throw new Error("Qonto ist nicht konfiguriert (QONTO_LOGIN / QONTO_SECRET_KEY / QONTO_IBAN).");
  }
  const draft = await qontoFetch<{
    client_invoice: { id: string; number?: string; status?: string };
  }>("/client_invoices", {
    method: "POST",
    body: JSON.stringify({
      client_id: input.clientId,
      issue_date: input.issueDate,
      due_date: input.dueDate,
      status: "draft",
      currency: input.currency,
      payment_methods: { iban: input.iban },
      items: input.items.map((item) => ({
        title: item.title.slice(0, 40),
        quantity: String(item.quantity),
        unit: item.unit,
        description: item.description,
        unit_price: {
          value: item.unit_price.value,
          currency: item.unit_price.currency,
        },
        vat_rate: item.vat_rate,
      })),
    }),
  });
  const draftId = draft.client_invoice?.id;
  if (!draftId) throw new Error("Qonto-Rechnung konnte nicht angelegt werden.");

  const finalized = await qontoFetch<{
    client_invoice: { id: string; number?: string; status?: string };
  }>(`/client_invoices/${draftId}/finalize`, { method: "POST" });

  const inv = finalized.client_invoice;
  return {
    id: inv?.id || draftId,
    invoice_number: inv?.number || draft.client_invoice.number || "",
    status: inv?.status || "unpaid",
  };
}

export async function sendClientInvoiceEmail(input: {
  invoiceId: string;
  recipientEmail: string;
  emailTitle?: string;
  emailBody?: string;
}): Promise<void> {
  if (!qontoConfigured()) {
    throw new Error("Qonto ist nicht konfiguriert (QONTO_LOGIN / QONTO_SECRET_KEY / QONTO_IBAN).");
  }
  await qontoFetch(`/client_invoices/${input.invoiceId}/send`, {
    method: "POST",
    okStatuses: [200, 201, 204],
    body: JSON.stringify({
      send_to: [input.recipientEmail.trim()],
      email_title: input.emailTitle || "Ihre Rechnung von White Gloss",
      email_body:
        input.emailBody ||
        "Anbei erhalten Sie Ihre Rechnung. Bei Fragen melden Sie sich gerne.",
      copy_to_self: true,
    }),
  });
}

export function qontoIban(): string {
  return (process.env.QONTO_IBAN || "").trim();
}
