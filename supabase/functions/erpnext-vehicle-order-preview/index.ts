import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

import {
  getVehicleOrderWriteGateStatus,
  issueVehicleOrderWriteConfirmation,
} from "../_shared/erpnextVehicleOrderWriteGate.ts";

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
const ELIGIBLE_STATUSES = new Set(["Bestätigt", "Bezahlt"]);
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
  label: string;
  kind: "package" | "addon";
};

const packageMap: Record<string, ServiceMapping> = {
  basis: { code: "WG-PKG-BASIS", label: "Basis Pflege", kind: "package" },
  premium: { code: "WG-PKG-PREMIUM", label: "Premium Glanz", kind: "package" },
  keramik: { code: "WG-PKG-KERAMIK", label: "High-End Keramik", kind: "package" },
};

const addOnMap: Record<string, ServiceMapping> = {
  felgen: { code: "WG-ADD-FELGEN", label: "Felgen-Spezial", kind: "addon" },
  leder: { code: "WG-ADD-LEDER", label: "Lederpflege Deluxe", kind: "addon" },
  motor: { code: "WG-ADD-MOTOR", label: "Motorwäsche", kind: "addon" },
  ozon: { code: "WG-ADD-OZON", label: "Innenraum-Ozon", kind: "addon" },
  scheinwerfer: {
    code: "WG-ADD-SCHEINWERFER",
    label: "Scheinwerfer-Aufbereitung",
    kind: "addon",
  },
  hol: { code: "WG-ADD-HOLBRING", label: "Hol- & Bringservice", kind: "addon" },
};

const vehicleClassLabels: Record<string, string> = {
  kompakt: "Kompaktklasse",
  suv: "SUV / Limousine",
  transporter: "Transporter",
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

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
  const writeGateEnabled = Deno.env.get("ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED");
  const approvedBookingId = Deno.env.get("ERPNEXT_VEHICLE_ORDER_APPROVED_BOOKING_ID");

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

  const verifyAuth = async () => {
    const auth = await erpRequest("/api/method/frappe.auth.get_logged_user");
    const message =
      auth.isJson && auth.payload && typeof auth.payload === "object"
        ? (auth.payload as { message?: unknown }).message
        : null;
    if (
      !auth.response.ok ||
      auth.location ||
      typeof message !== "string" ||
      !message ||
      message === "Guest"
    ) {
      throw new Error(`erpnext_auth_failed:${auth.response.status}`);
    }
  };

  try {
    await verifyAuth();

    if (body.action === "list") {
      const { data: bookings, error: bookingError } = await supabase
        .from("bookings")
        .select("id, booking_date, customer_name, customer_email, status")
        .in("status", ["Bestätigt", "Bezahlt"])
        .order("booking_date", { ascending: false })
        .limit(20);
      if (bookingError) return json({ ok: false, error: "booking_list_failed" }, 500);

      const ids = (bookings ?? []).map((booking) => booking.id);
      const customerReady = new Set<string>();
      if (ids.length > 0) {
        const { data: states, error: stateError } = await supabase
          .from("booking_automation_state")
          .select("booking_id, erpnext_customer_id")
          .in("booking_id", ids);
        if (stateError) return json({ ok: false, error: "booking_state_list_failed" }, 500);
        for (const state of states ?? []) {
          if (state.erpnext_customer_id) customerReady.add(String(state.booking_id));
        }
      }

      return json({
        ok: true,
        mode: "preview",
        writes_performed: false,
        bookings: (bookings ?? []).map((booking) => ({
          id: booking.id,
          booking_date: booking.booking_date,
          customer_name: booking.customer_name,
          status: booking.status,
          customer_ready: customerReady.has(String(booking.id)),
        })),
      });
    }

    const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!UUID_RE.test(bookingId)) return json({ ok: false, error: "invalid_booking_id" }, 400);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, invoice_number, vehicle_id, package_id, add_on_ids, booking_date, booking_time, pickup_city, customer_name, customer_email, customer_plate, preferred_contact, total, agreed_price, status, booking_source, updated_at",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingError) return json({ ok: false, error: "booking_load_failed" }, 500);
    if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);
    if (!ELIGIBLE_STATUSES.has(String(booking.status ?? ""))) {
      return json({ ok: false, error: "booking_not_preview_eligible" }, 409);
    }

    const { data: state, error: stateError } = await supabase
      .from("booking_automation_state")
      .select("erpnext_customer_id")
      .eq("booking_id", booking.id)
      .maybeSingle();
    if (stateError) return json({ ok: false, error: "booking_state_load_failed" }, 500);
    const customerId =
      typeof state?.erpnext_customer_id === "string" ? state.erpnext_customer_id : "";
    if (!customerId) return json({ ok: false, error: "customer_not_synced" }, 409);

    const normalizedEmail = normalizeEmail(String(booking.customer_email ?? ""));
    const { data: customerMapping, error: mappingError } = await supabase
      .from("erpnext_customer_mappings")
      .select("erpnext_customer_id, erpnext_contact_id, synced_at, last_error")
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();
    if (mappingError) return json({ ok: false, error: "customer_mapping_load_failed" }, 500);
    if (
      !customerMapping?.synced_at ||
      customerMapping.last_error ||
      customerMapping.erpnext_customer_id !== customerId
    ) {
      return json({ ok: false, error: "customer_mapping_not_ready" }, 409);
    }

    const plate = String(booking.customer_plate ?? "").trim();
    const normalizedPlate = normalizePlate(plate);
    if (normalizedPlate.length < 3) {
      return json({ ok: false, error: "vehicle_plate_required_for_safe_identity" }, 409);
    }

    const packageMapping = packageMap[String(booking.package_id ?? "")];
    if (!packageMapping) return json({ ok: false, error: "unknown_package_mapping" }, 409);

    const addOnIds = Array.isArray(booking.add_on_ids) ? booking.add_on_ids.map(String) : [];
    const mappedAddOns: ServiceMapping[] = [];
    for (const id of addOnIds) {
      const mapped = addOnMap[id];
      if (!mapped) return json({ ok: false, error: `unknown_addon_mapping:${id}` }, 409);
      mappedAddOns.push(mapped);
    }

    const serviceMappings = [packageMapping, ...mappedAddOns];
    const serviceChecks = await Promise.all(
      serviceMappings.map(async (service) => {
        const rows = await listRows(
          "Item",
          ["name", "item_code", "item_name", "disabled", "is_sales_item", "is_stock_item"],
          [["item_code", "=", service.code]],
          2,
        );
        if (rows.length !== 1) return { ...service, ready: false };
        const row = rows[0];
        const ready =
          row.item_code === service.code &&
          row.disabled !== 1 &&
          row.disabled !== true &&
          (row.is_sales_item === 1 || row.is_sales_item === true) &&
          row.is_stock_item !== 1 &&
          row.is_stock_item !== true;
        return {
          ...service,
          ready,
          item_name: typeof row.item_name === "string" ? row.item_name : service.label,
        };
      }),
    );
    if (serviceChecks.some((service) => !service.ready)) {
      return json({ ok: false, error: "service_catalog_not_ready_for_booking" }, 409);
    }

    const customerRows = await listRows("Customer", ["name"], [["name", "=", customerId]], 2);
    if (customerRows.length !== 1) {
      return json({ ok: false, error: "mapped_customer_missing_in_erpnext" }, 409);
    }

    const vehicleRows = await listRows(
      VEHICLE_DOCTYPE,
      [
        "name",
        "customer",
        "registration_plate",
        "registration_plate_normalized",
        "external_reference",
      ],
      [["registration_plate_normalized", "=", normalizedPlate]],
      2,
    );
    if (vehicleRows.length > 1) {
      return json({ ok: false, error: "multiple_vehicle_plate_matches" }, 409);
    }

    const existingVehicle = vehicleRows[0] ?? null;
    if (existingVehicle && existingVehicle.customer !== customerId) {
      return json({ ok: false, error: "vehicle_customer_conflict" }, 409);
    }

    const orderRows = await listRows(
      ORDER_DOCTYPE,
      ["name", "booking_id", "customer", "vehicle", "status"],
      [["booking_id", "=", booking.id]],
      2,
    );
    if (orderRows.length > 1) {
      return json({ ok: false, error: "multiple_booking_order_matches" }, 409);
    }

    const existingOrder = orderRows[0] ?? null;
    if (existingOrder && existingOrder.customer !== customerId) {
      return json({ ok: false, error: "order_customer_conflict" }, 409);
    }
    if (existingOrder && !existingVehicle) {
      return json({ ok: false, error: "existing_order_without_exact_vehicle_match" }, 409);
    }
    if (
      existingOrder &&
      existingVehicle &&
      typeof existingOrder.vehicle === "string" &&
      existingOrder.vehicle !== existingVehicle.name
    ) {
      return json({ ok: false, error: "order_vehicle_conflict" }, 409);
    }

    const vehicleExternalReference = `plate:${normalizedPlate}`;
    const vehicleClassId = String(booking.vehicle_id ?? "");
    const vehicleClassLabel = vehicleClassLabels[vehicleClassId] ?? vehicleClassId;
    const total = Number(booking.agreed_price ?? booking.total ?? 0);
    const productionWriteGate = getVehicleOrderWriteGateStatus({
      enabledValue: writeGateEnabled,
      approvedBookingId,
      bookingId: booking.id,
    });
    const productionWriteConfirmation = productionWriteGate.ready
      ? await issueVehicleOrderWriteConfirmation({
          secret: serviceRoleKey,
          bookingId: booking.id,
          bookingRevision: String(booking.updated_at ?? ""),
        })
      : null;

    return json({
      ok: true,
      mode: "preview",
      writes_performed: false,
      write_ready: true,
      production_write: {
        enabled: productionWriteGate.enabled,
        booking_approved: productionWriteGate.bookingApproved,
        ready: productionWriteGate.ready,
        confirmation: productionWriteConfirmation,
      },
      booking_id: booking.id,
      customer: {
        erpnext_customer_id: customerId,
        erpnext_contact_id: customerMapping.erpnext_contact_id,
        state: "already_synced",
      },
      vehicle: {
        state: existingVehicle ? "existing_exact_plate" : "create_needed",
        erpnext_vehicle_id: existingVehicle?.name ?? null,
        identity_basis: "normalized_plate",
        payload: {
          customer: customerId,
          registration_plate: plate,
          registration_plate_normalized: normalizedPlate,
          vehicle_class_id: vehicleClassId,
          vehicle_class_label: vehicleClassLabel,
          external_reference: vehicleExternalReference,
        },
      },
      order: {
        state: existingOrder ? "existing_booking_order" : "create_needed",
        erpnext_order_id: existingOrder?.name ?? null,
        payload: {
          customer: customerId,
          vehicle: existingVehicle?.name ?? "<vehicle-after-create>",
          booking_id: booking.id,
          source_reference: booking.invoice_number,
          status: "Bestätigt",
          service_date: booking.booking_date,
          date_only: true,
          handover_time: null,
          pickup_city: booking.pickup_city,
          preferred_contact: booking.preferred_contact,
          booking_source: booking.booking_source,
          agreed_gross_total: Number.isFinite(total) ? total : null,
          payment_status: booking.status === "Bezahlt" ? "Bezahlt" : "Ausstehend",
        },
      },
      services: serviceChecks.map((service) => ({
        item: service.code,
        item_code_snapshot: service.code,
        item_name_snapshot: service.item_name ?? service.label,
        service_kind: service.kind,
        qty: 1,
      })),
      notes: {
        booking_time_ignored: Boolean(booking.booking_time),
        date_only_rule: "handover_time_remains_empty_until_separately_coordinated",
        pickup_tier_not_inferred: addOnIds.includes("hol"),
      },
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    const message = error instanceof Error ? error.message : "erpnext_unreachable";
    return json({ ok: false, error: timeout ? "erpnext_timeout" : message }, 502);
  }
});
