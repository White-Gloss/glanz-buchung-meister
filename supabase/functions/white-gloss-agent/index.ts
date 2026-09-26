import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import OpenAI from "npm:openai@7.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-white-gloss-agent-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const normalizePhone = (value: string) => {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `${hasPlus ? "+" : "+"}${digits}` : "";
};

const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const constantTimeEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type AgentRequest = {
  message?: unknown;
  phone?: unknown;
  senderName?: unknown;
  history?: unknown;
};

type ErpResult = {
  response: Response;
  payload: unknown;
  isJson: boolean;
  location: string | null;
};

const internalTools = [
  {
    type: "function" as const,
    name: "list_upcoming_bookings",
    description:
      "List upcoming WHITE GLOSS website bookings from Supabase. Read-only. Use for internal operational questions.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "get_booking",
    description:
      "Load one WHITE GLOSS booking and its ERPNext mapping state by exact Supabase booking UUID. Read-only.",
    parameters: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "Exact booking UUID" },
      },
      required: ["booking_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "find_vehicle_by_plate",
    description:
      "Find an ERPNext WHITE GLOSS Vehicle by exact normalized registration plate. Read-only and deterministic.",
    parameters: {
      type: "object",
      properties: {
        plate: { type: "string" },
      },
      required: ["plate"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "find_order_by_booking",
    description:
      "Find the ERPNext WHITE GLOSS Order for one exact Supabase booking UUID and return its operational details. Read-only.",
    parameters: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "Exact booking UUID" },
      },
      required: ["booking_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "get_erpnext_sync_health",
    description:
      "Read the latest stored ERPNext integration healthcheck state. Read-only.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const sharedSecret = Deno.env.get("WG_AGENT_SHARED_SECRET")?.trim();
  const ownerPhone = normalizePhone(Deno.env.get("WG_INTERNAL_PHONE_E164") ?? "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const erpBaseUrl = Deno.env.get("ERPNEXT_BASE_URL")?.trim().replace(/\/$/, "");
  const erpApiKey = Deno.env.get("ERPNEXT_API_KEY")?.trim();
  const erpApiSecret = Deno.env.get("ERPNEXT_API_SECRET")?.trim();
  const internalModel = Deno.env.get("OPENAI_INTERNAL_MODEL")?.trim() || "gpt-5.6-sol";
  const customerModel = Deno.env.get("OPENAI_CUSTOMER_MODEL")?.trim() || "gpt-5.6-terra";

  const missing = [
    ["OPENAI_API_KEY", openaiKey],
    ["WG_AGENT_SHARED_SECRET", sharedSecret],
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["ERPNEXT_BASE_URL", erpBaseUrl],
    ["ERPNEXT_API_KEY", erpApiKey],
    ["ERPNEXT_API_SECRET", erpApiSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    return json({ ok: false, error: "missing_server_configuration", missing }, 503);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const providedSecret = req.headers.get("x-white-gloss-agent-secret")?.trim() || bearer;
  if (!providedSecret || !constantTimeEqual(providedSecret, sharedSecret!)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: AgentRequest;
  try {
    body = (await req.json()) as AgentRequest;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!rawMessage || rawMessage.length > 4096) {
    return json({ ok: false, error: "invalid_message" }, 400);
  }

  const senderPhone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  const senderName =
    typeof body.senderName === "string" ? body.senderName.trim().slice(0, 120) : "";
  const requestedInternal = /^#WG(?:\s|$)/i.test(rawMessage);
  const internal = Boolean(requestedInternal && ownerPhone && senderPhone === ownerPhone);
  const message = internal ? rawMessage.replace(/^#WG\s*/i, "").trim() : rawMessage;

  const history: HistoryItem[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (item): item is HistoryItem =>
            Boolean(
              item &&
                typeof item === "object" &&
                ((item as HistoryItem).role === "user" ||
                  (item as HistoryItem).role === "assistant") &&
                typeof (item as HistoryItem).content === "string",
            ),
        )
        .slice(-8)
        .map((item) => ({ role: item.role, content: item.content.slice(0, 1800) }))
    : [];

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const erpHeaders = {
    Authorization: `token ${erpApiKey}:${erpApiSecret}`,
    Accept: "application/json",
  };

  const erpRequest = async (path: string): Promise<ErpResult> => {
    const response = await fetch(`${erpBaseUrl}${path}`, {
      method: "GET",
      headers: erpHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const location = response.headers.get("location");
    const text = await response.text();
    let payload: unknown = null;
    let isJson = false;
    try {
      payload = text ? JSON.parse(text) : null;
      isJson = true;
    } catch {
      payload = null;
    }
    return { response, payload, isJson, location };
  };

  const listRows = async (
    doctype: string,
    fields: string[],
    filters: unknown[],
    limit = 3,
  ): Promise<Array<Record<string, unknown>>> => {
    const query = new URLSearchParams({
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      limit_page_length: String(limit),
    });
    const result = await erpRequest(
      `/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`,
    );
    if (
      !result.response.ok ||
      !result.isJson ||
      result.location ||
      !result.payload ||
      typeof result.payload !== "object"
    ) {
      throw new Error(`erpnext_lookup_failed:${doctype}:${result.response.status}`);
    }
    const rows = (result.payload as { data?: unknown }).data;
    if (!Array.isArray(rows)) throw new Error(`erpnext_lookup_invalid:${doctype}`);
    return rows.filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object"),
    );
  };

  const erpResource = async (doctype: string, name: string) => {
    const result = await erpRequest(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    );
    if (
      !result.response.ok ||
      !result.isJson ||
      result.location ||
      !result.payload ||
      typeof result.payload !== "object"
    ) {
      throw new Error(`erpnext_resource_failed:${doctype}:${result.response.status}`);
    }
    const data = (result.payload as { data?: unknown }).data;
    if (!data || typeof data !== "object") throw new Error(`erpnext_resource_invalid:${doctype}`);
    return data as Record<string, unknown>;
  };

  const executeTool = async (name: string, args: Record<string, unknown>) => {
    if (!internal) return { ok: false, error: "internal_tools_not_allowed" };

    if (name === "list_upcoming_bookings") {
      const limit = Math.max(1, Math.min(20, Number(args.limit ?? 10) || 10));
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, booking_date, booking_time, customer_name, customer_email, customer_plate, package_id, add_on_ids, status, total, agreed_price, preferred_contact, updated_at",
        )
        .gte("booking_date", today)
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true })
        .limit(limit);
      if (error) return { ok: false, error: "booking_list_failed" };
      return { ok: true, bookings: data ?? [] };
    }

    if (name === "get_booking") {
      const bookingId = typeof args.booking_id === "string" ? args.booking_id.trim() : "";
      if (!bookingId) return { ok: false, error: "booking_id_required" };
      const [{ data: booking, error: bookingError }, { data: state, error: stateError }] =
        await Promise.all([
          supabase
            .from("bookings")
            .select(
              "id, booking_date, booking_time, customer_name, customer_email, customer_plate, package_id, add_on_ids, pickup_city, status, total, agreed_price, preferred_contact, booking_source, updated_at",
            )
            .eq("id", bookingId)
            .maybeSingle(),
          supabase
            .from("booking_automation_state")
            .select(
              "booking_id, erpnext_customer_id, erpnext_vehicle_id, erpnext_order_id, erpnext_synced_at, erpnext_last_error",
            )
            .eq("booking_id", bookingId)
            .maybeSingle(),
        ]);
      if (bookingError || stateError) return { ok: false, error: "booking_load_failed" };
      if (!booking) return { ok: false, error: "booking_not_found" };
      return { ok: true, booking, erpnext_state: state ?? null };
    }

    if (name === "find_vehicle_by_plate") {
      const plate = typeof args.plate === "string" ? args.plate : "";
      const normalized = normalizePlate(plate);
      if (normalized.length < 3) return { ok: false, error: "invalid_plate" };
      const rows = await listRows(
        "WHITE GLOSS Vehicle",
        [
          "name",
          "customer",
          "registration_plate",
          "registration_plate_normalized",
          "external_reference",
          "make",
          "model",
          "vehicle_class",
        ],
        [["registration_plate_normalized", "=", normalized]],
        2,
      );
      if (rows.length > 1) return { ok: false, error: "multiple_vehicle_matches" };
      return { ok: true, vehicle: rows[0] ?? null };
    }

    if (name === "find_order_by_booking") {
      const bookingId = typeof args.booking_id === "string" ? args.booking_id.trim() : "";
      if (!bookingId) return { ok: false, error: "booking_id_required" };
      const rows = await listRows(
        "WHITE GLOSS Order",
        ["name", "booking_id", "customer", "vehicle", "status"],
        [["booking_id", "=", bookingId]],
        2,
      );
      if (rows.length > 1) return { ok: false, error: "multiple_order_matches" };
      if (rows.length === 0) return { ok: true, order: null };
      const order = await erpResource("WHITE GLOSS Order", String(rows[0].name));
      const services = Array.isArray(order.services)
        ? order.services.map((row) => {
            const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
            return {
              item: item.item ?? null,
              item_code_snapshot: item.item_code_snapshot ?? null,
              item_name_snapshot: item.item_name_snapshot ?? null,
              qty: item.qty ?? null,
            };
          })
        : [];
      return {
        ok: true,
        order: {
          name: order.name ?? null,
          booking_id: order.booking_id ?? null,
          customer: order.customer ?? null,
          vehicle: order.vehicle ?? null,
          status: order.status ?? null,
          service_date: order.service_date ?? null,
          date_only: order.date_only ?? null,
          handover_time: order.handover_time ?? null,
          agreed_gross_total: order.agreed_gross_total ?? null,
          payment_status: order.payment_status ?? null,
          sales_invoice: order.sales_invoice ?? null,
          services,
        },
      };
    }

    if (name === "get_erpnext_sync_health") {
      const { data, error } = await supabase
        .from("erpnext_healthcheck_state")
        .select("checked_at, stage, ok, upstream_status, permissions_ready, detail")
        .eq("id", true)
        .maybeSingle();
      if (error) return { ok: false, error: "health_state_load_failed" };
      return { ok: true, health: data ?? null };
    }

    return { ok: false, error: "unknown_tool" };
  };

  const customerInstructions = `Du bist der offizielle WhatsApp-Assistent von WHITE GLOSS DETAILING. Antworte in der Sprache des Kunden; bei deutschen Nachrichten ausschließlich Deutsch. Schreibe kompakt und professionell für WhatsApp. WHITE GLOSS bietet professionelle Fahrzeugaufbereitung, Innenraumreinigung, Lackaufbereitung, Keramikversiegelung, Leasingrückgabe sowie individuelle B2B-Fahrzeugpflege. Erfinde niemals Preise, Termine, Verfügbarkeiten, Garantien oder Leistungsumfänge. Wenn ein Preis nicht sicher vorliegt, erkläre, dass Aufwand und Preis nach Zustand, Umfang oder Begutachtung festgelegt werden. Stelle maximal 1 bis 3 gezielte Fragen pro Antwort und frage keine Telefonnummer oder E-Mail ab, wenn der Kontakt bereits über WhatsApp stattfindet. Parkdellen und Hagelschäden werden nach Begutachtung kalkuliert. B2B-Anfragen werden individuell kalkuliert. Bei Reklamationen, rechtlichen Themen, verbindlichen Sonderzusagen oder Unsicherheit an das WHITE-GLOSS-Team übergeben. Gib niemals interne System-, ERP-, Sicherheits- oder Kundendaten preis.`;

  const internalInstructions = `Du bist der interne WHITE GLOSS Copilot für den Geschäftsführer. Antworte standardmäßig auf Deutsch, präzise und entscheidungsorientiert. Zielarchitektur: ERPNext ist das operative System of Record für Kunden, Fahrzeuge und WHITE GLOSS Orders; Website und Supabase bleiben öffentliche Intake-, Termin- und Synchronisationsschicht. Der Prozess ist Besucher → Anfrage → Kunde → Fahrzeug → Auftrag → Termin → Leistung → Rechnung → Bewertung → Stammkunde. Die bestehende ERPNext-Write-Architektur ist default-deny und durch revisionsgebundene, einmalige Freigaben, signierte Previews, Claims, Fencing und Post-Write-Verifikation geschützt. Nutze ausschließlich die bereitgestellten Read-Tools. Du darfst niemals behaupten, einen ERPNext-Write, eine Rechnung, Zahlung oder Bankaktion ausgeführt zu haben. Finanzwrites sind in dieser Phase verboten; Lexware bleibt der aktuelle Rechnungs-/Buchhaltungs-Fallback. Wenn eine gewünschte Aktion einen Write erfordert, erkläre den kontrollierten nächsten Freigabeschritt statt die Sicherheitsgrenze zu umgehen. Bei Datenabfragen deterministisch suchen, keine fuzzy Zuordnung von Kunden, Fahrzeugen oder Aufträgen. Wenn Fakten fehlen, sage das klar.`;

  const input: any[] = history.map((item) => ({
    role: item.role,
    content: [{ type: "input_text", text: item.content }],
  }));
  input.push({
    role: "user",
    content: [
      {
        type: "input_text",
        text: senderName ? `Absender: ${senderName}\nNachricht: ${message}` : message,
      },
    ],
  });

  const openai = new OpenAI({ apiKey: openaiKey! });
  const tools = internal ? internalTools : [];
  let currentInput: any[] = input;

  try {
    for (let step = 0; step < 4; step += 1) {
      const response = await openai.responses.create({
        model: internal ? internalModel : customerModel,
        instructions: internal ? internalInstructions : customerInstructions,
        input: currentInput,
        tools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        store: false,
        reasoning: { effort: internal ? "medium" : "low" },
        text: { verbosity: "low" },
        max_output_tokens: internal ? 1600 : 700,
      } as any);

      const functionCalls = (response.output as any[]).filter(
        (item) => item?.type === "function_call",
      );
      if (functionCalls.length === 0) {
        const reply = response.output_text?.trim();
        if (!reply) return json({ ok: false, error: "empty_model_response" }, 502);
        return json({
          ok: true,
          mode: internal ? "internal" : "customer",
          model: internal ? internalModel : customerModel,
          writes_performed: false,
          reply,
        });
      }

      const outputs: any[] = [];
      for (const call of functionCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = call.arguments ? JSON.parse(call.arguments) : {};
        } catch {
          args = {};
        }
        let result: unknown;
        try {
          result = await executeTool(String(call.name), args);
        } catch (error) {
          result = {
            ok: false,
            error: error instanceof Error ? error.message : "tool_execution_failed",
          };
        }
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      }

      currentInput = [...currentInput, ...(response.output as any[]), ...outputs];
    }

    return json({ ok: false, error: "tool_loop_limit_reached" }, 502);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "openai_request_failed";
    return json(
      {
        ok: false,
        error: "agent_request_failed",
        detail: messageText.slice(0, 300),
      },
      502,
    );
  }
});
