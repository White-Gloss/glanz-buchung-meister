import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VEHICLE_DOCTYPE = "WHITE GLOSS Vehicle";
const ORDER_DOCTYPE = "WHITE GLOSS Order";

type RequestBody = {
  action?: unknown;
  bookingId?: unknown;
};

type ErpResult = {
  response: Response;
  payload: unknown;
  isJson: boolean;
  location: string | null;
};

type ServiceMapping = {
  code: string;
  kind: "package" | "addon";
};

const packageMap: Record<string, ServiceMapping> = {
  basis: { code: "WG-PKG-BASIS", kind: "package" },
  premium: { code: "WG-PKG-PREMIUM", kind: "package" },
  keramik: { code: "WG-PKG-KERAMIK", kind: "package" },
};

const addOnMap: Record<string, ServiceMapping> = {
  felgen: { code: "WG-ADD-FELGEN", kind: "addon" },
  leder: { code: "WG-ADD-LEDER", kind: "addon" },
  motor: { code: "WG-ADD-MOTOR", kind: "addon" },
  ozon: { code: "WG-ADD-OZON", kind: "addon" },
  scheinwerfer: { code: "WG-ADD-SCHEINWERFER", kind: "addon" },
  hol: { code: "WG-ADD-HOLBRING", kind: "addon" },
};

const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const asText = (value: unknown) => (typeof value === "string" ? value : "");
const asBoolean = (value: unknown) => value === true || value === 1 || value === "1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = Deno.env.get("ERPNEXT_BASE_URL")?.trim().replace(/\/$/, "");
  const apiKey = Deno.env.get("ERPNEXT_API_KEY")?.trim();
  const apiSecret = Deno.env.get("ERPNEXT_API_SECRET")?.trim();

  if (!supabaseUrl || !serviceRoleKey || !baseUrl || !apiKey || !apiSecret) {
    return json({ ok: false, error: "missing_server_configuration" }, 500);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "authentication_required" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) return json({ ok: false, error: "invalid_session" }, 401);

  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError) return json({ ok: false, error: "role_check_failed" }, 500);
  if (!role) return json({ ok: false, error: "admin_required" }, 403);

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    body = {};
  }

  const erpHeaders = {
    Authorization: `token ${apiKey}:${apiSecret}`,
    Accept: "application/json",
  };

  const erpRequest = async (path: string): Promise<ErpResult> => {
    const response = await fetch(`${baseUrl}${path}`, {
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

  const resource = async (doctype: string, name: string): Promise<Record<string, unknown>> => {
    const result = await erpRequest(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    );
    if (!result.response.ok || !result.isJson || result.location) {
      throw new Error(`erpnext_resource_failed:${doctype}:${result.response.status}`);
    }
    const data =
      result.payload && typeof result.payload === "object"
        ? (result.payload as { data?: unknown }).data
        : null;
    if (!data || typeof data !== "object") throw new Error(`erpnext_resource_invalid:${doctype}`);
    return data as Record<string, unknown>;
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
    if (!result.response.ok || !result.isJson || result.location) {
      throw new Error(`erpnext_lookup_failed:${doctype}:${result.response.status}`);
    }
    const rows =
      result.payload && typeof result.payload === "object"
        ? (result.payload as { data?: unknown }).data
        : null;
    if (!Array.isArray(rows)) throw new Error(`erpnext_lookup_invalid:${doctype}`);
    return rows.filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object"),
    );
  };

  const auth = await erpRequest("/api/method/frappe.auth.get_logged_user");
  const authMessage =
    auth.isJson && auth.payload && typeof auth.payload === "object"
      ? (auth.payload as { message?: unknown }).message
      : null;
  if (
    !auth.response.ok ||
    auth.location ||
    typeof authMessage !== "string" ||
    !authMessage ||
    authMessage === "Guest"
  ) {
    return json({ ok: false, error: "erpnext_auth_failed" }, 502);
  }

  if (body.action === "list") {
    const { data, error } = await supabase
      .from("booking_automation_state")
      .select("booking_id, erpnext_customer_id, erpnext_vehicle_id, erpnext_order_id, erpnext_synced_at")
      .not("erpnext_vehicle_id", "is", null)
      .not("erpnext_order_id", "is", null)
      .order("erpnext_synced_at", { ascending: false })
      .limit(20);
    if (error) return json({ ok: false, error: "sync_state_list_failed" }, 500);

    const ids = (data ?? []).map((row) => String(row.booking_id));
    const byId = new Map<string, { booking_date: string; customer_name: string; status: string }>();
    if (ids.length > 0) {
      const { data: bookings, error: bookingError } = await supabase
        .from("bookings")
        .select("id, booking_date, customer_name, status")
        .in("id", ids);
      if (bookingError) return json({ ok: false, error: "booking_list_failed" }, 500);
      for (const booking of bookings ?? []) {
        byId.set(String(booking.id), {
          booking_date: String(booking.booking_date),
          customer_name: String(booking.customer_name),
          status: String(booking.status),
        });
      }
    }

    return json({
      ok: true,
      writes_performed: false,
      bookings: (data ?? []).map((row) => ({
        id: String(row.booking_id),
        booking_date: byId.get(String(row.booking_id))?.booking_date ?? "",
        customer_name: byId.get(String(row.booking_id))?.customer_name ?? "",
        status: byId.get(String(row.booking_id))?.status ?? "",
        erpnext_vehicle_id: row.erpnext_vehicle_id,
        erpnext_order_id: row.erpnext_order_id,
        synced_at: row.erpnext_synced_at,
      })),
    });
  }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!UUID_RE.test(bookingId)) return json({ ok: false, error: "invalid_booking_id" }, 400);

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, vehicle_id, package_id, add_on_ids, booking_date, booking_time, customer_plate, total, agreed_price, status",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) return json({ ok: false, error: "booking_load_failed" }, 500);
  if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);

  const { data: state, error: stateError } = await supabase
    .from("booking_automation_state")
    .select("erpnext_customer_id, erpnext_vehicle_id, erpnext_order_id, erpnext_synced_at, erpnext_last_error")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (stateError) return json({ ok: false, error: "booking_state_load_failed" }, 500);
  if (
    !state?.erpnext_customer_id ||
    !state.erpnext_vehicle_id ||
    !state.erpnext_order_id ||
    !state.erpnext_synced_at ||
    state.erpnext_last_error
  ) {
    return json({ ok: false, error: "sync_state_not_verifiable" }, 409);
  }

  try {
    const normalizedPlate = normalizePlate(String(booking.customer_plate ?? ""));
    if (normalizedPlate.length < 3) {
      return json({ ok: false, error: "vehicle_plate_required_for_safe_identity" }, 409);
    }

    const expectedServices: ServiceMapping[] = [];
    const packageMapping = packageMap[String(booking.package_id ?? "")];
    if (!packageMapping) return json({ ok: false, error: "unknown_package_mapping" }, 409);
    expectedServices.push(packageMapping);

    const addOnIds = Array.isArray(booking.add_on_ids) ? booking.add_on_ids.map(String) : [];
    for (const id of addOnIds) {
      const mapped = addOnMap[id];
      if (!mapped) return json({ ok: false, error: `unknown_addon_mapping:${id}` }, 409);
      expectedServices.push(mapped);
    }

    const [vehicle, order, vehicleMatches, orderMatches] = await Promise.all([
      resource(VEHICLE_DOCTYPE, String(state.erpnext_vehicle_id)),
      resource(ORDER_DOCTYPE, String(state.erpnext_order_id)),
      listRows(
        VEHICLE_DOCTYPE,
        ["name", "customer", "registration_plate_normalized"],
        [["registration_plate_normalized", "=", normalizedPlate]],
        3,
      ),
      listRows(
        ORDER_DOCTYPE,
        ["name", "booking_id", "customer", "vehicle"],
        [["booking_id", "=", bookingId]],
        3,
      ),
    ]);

    const serviceRows = Array.isArray(order.services)
      ? order.services.filter((row): row is Record<string, unknown> =>
          Boolean(row && typeof row === "object"),
        )
      : [];
    const expectedCodes = expectedServices.map((service) => service.code).sort();
    const actualCodes = serviceRows.map((row) => asText(row.item)).sort();
    const serviceSetMatches =
      expectedCodes.length === actualCodes.length &&
      expectedCodes.every((code, index) => code === actualCodes[index]);
    const serviceSnapshotsValid = serviceRows.every(
      (row) =>
        asText(row.item).length > 0 &&
        asText(row.item_code_snapshot) === asText(row.item) &&
        asText(row.item_name_snapshot).length > 0 &&
        Number(row.qty) > 0,
    );

    const expectedTotalRaw = Number(booking.agreed_price ?? booking.total ?? 0);
    const expectedTotal = Number.isFinite(expectedTotalRaw) ? expectedTotalRaw : 0;
    const actualTotal = Number(order.agreed_gross_total ?? 0);
    const totalMatches = Math.abs(expectedTotal - actualTotal) < 0.005;
    const expectedPayment = booking.status === "Bezahlt" ? "Bezahlt" : "Ausstehend";

    const checks = {
      vehicle_id_matches_state: asText(vehicle.name) === String(state.erpnext_vehicle_id),
      vehicle_customer_matches: asText(vehicle.customer) === String(state.erpnext_customer_id),
      vehicle_plate_matches: asText(vehicle.registration_plate_normalized) === normalizedPlate,
      vehicle_external_reference_matches:
        asText(vehicle.external_reference) === `plate:${normalizedPlate}`,
      vehicle_unique_by_plate: vehicleMatches.length === 1,
      order_id_matches_state: asText(order.name) === String(state.erpnext_order_id),
      order_booking_id_matches: asText(order.booking_id) === bookingId,
      order_customer_matches: asText(order.customer) === String(state.erpnext_customer_id),
      order_vehicle_matches: asText(order.vehicle) === String(state.erpnext_vehicle_id),
      order_unique_by_booking: orderMatches.length === 1,
      service_date_matches: asText(order.service_date).slice(0, 10) === String(booking.booking_date).slice(0, 10),
      date_only_preserved: asBoolean(order.date_only),
      handover_time_empty: !order.handover_time,
      services_match_booking: serviceSetMatches,
      service_snapshots_valid: serviceSnapshotsValid,
      agreed_total_matches: totalMatches,
      payment_status_matches: asText(order.payment_status) === expectedPayment,
      no_linked_sales_invoice: !order.sales_invoice,
    };

    const failed = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    return json({
      ok: failed.length === 0,
      writes_performed: false,
      booking_id: bookingId,
      vehicle_id: state.erpnext_vehicle_id,
      order_id: state.erpnext_order_id,
      duplicate_counts: {
        vehicle_by_plate: vehicleMatches.length,
        order_by_booking: orderMatches.length,
      },
      checks,
      failed_checks: failed,
      services: actualCodes,
      expected_services: expectedCodes,
      financial_links: {
        sales_invoice: order.sales_invoice ?? null,
      },
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return json(
      {
        ok: false,
        writes_performed: false,
        error: timeout
          ? "erpnext_timeout"
          : error instanceof Error
            ? error.message
            : "erpnext_post_write_verification_failed",
      },
      502,
    );
  }
});
