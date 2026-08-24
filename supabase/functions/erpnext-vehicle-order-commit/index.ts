import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

import {
  evaluateVehicleOrderWriteGate,
  getVehicleOrderWriteGateStatus,
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
  bookingId?: unknown;
  confirmation?: unknown;
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
  const writeGateEnabled = Deno.env.get("ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED");
  const approvedBookingId = Deno.env.get("ERPNEXT_VEHICLE_ORDER_APPROVED_BOOKING_ID");

  if (!supabaseUrl || !serviceRoleKey) {
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

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!UUID_RE.test(bookingId)) return json({ ok: false, error: "invalid_booking_id" }, 400);

  const writeGateStatus = getVehicleOrderWriteGateStatus({
    enabledValue: writeGateEnabled,
    approvedBookingId,
    bookingId,
  });
  if (!writeGateStatus.enabled || !writeGateStatus.bookingApproved) {
    return json(
      {
        ok: false,
        error: !writeGateStatus.enabled
          ? "production_write_gate_disabled"
          : "production_write_booking_not_approved",
        writes_performed: false,
        financial_writes: false,
      },
      409,
    );
  }

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
    return json({ ok: false, error: "booking_not_write_eligible" }, 409);
  }

  const writeGate = evaluateVehicleOrderWriteGate({
    enabledValue: writeGateEnabled,
    approvedBookingId,
    bookingId,
    bookingRevision: booking.updated_at,
    confirmation: body.confirmation,
  });
  if (writeGate.error) {
    return json(
      {
        ok: false,
        error: writeGate.error,
        writes_performed: false,
        financial_writes: false,
      },
      409,
    );
  }

  if (!baseUrl || !apiKey || !apiSecret) {
    return json({ ok: false, error: "missing_server_configuration" }, 500);
  }

  const erpHeaders = {
    Authorization: `token ${apiKey}:${apiSecret}`,
    Accept: "application/json",
  };

  const erpRequest = async (
    method: "GET" | "POST",
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<ErpResult> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...erpHeaders,
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const location = response.headers.get("location");
    const text = await response.text();
    let parsed: unknown = null;
    let isJson = false;
    try {
      parsed = text ? JSON.parse(text) : null;
      isJson = true;
    } catch {
      parsed = null;
    }
    return { response, payload: parsed, isJson, location };
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
      "GET",
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

  const resource = async (doctype: string, name: string): Promise<Record<string, unknown>> => {
    const result = await erpRequest(
      "GET",
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
    if (!data || typeof data !== "object") {
      throw new Error(`erpnext_resource_invalid:${doctype}`);
    }
    return data as Record<string, unknown>;
  };

  const verifyPersistedVehicle = async (
    vehicleId: string,
    customerId: string,
    normalizedPlate: string,
  ) => {
    const vehicle = await resource(VEHICLE_DOCTYPE, vehicleId);
    return (
      asText(vehicle.name) === vehicleId &&
      asText(vehicle.customer) === customerId &&
      asText(vehicle.registration_plate_normalized) === normalizedPlate &&
      asText(vehicle.external_reference) === `plate:${normalizedPlate}`
    );
  };

  const verifyPersistedOrder = async ({
    orderId,
    bookingId,
    customerId,
    vehicleId,
    serviceDate,
    expectedServiceCodes,
    agreedTotal,
    paymentStatus,
  }: {
    orderId: string;
    bookingId: string;
    customerId: string;
    vehicleId: string;
    serviceDate: string;
    expectedServiceCodes: string[];
    agreedTotal: number;
    paymentStatus: string;
  }) => {
    const order = await resource(ORDER_DOCTYPE, orderId);
    const serviceRows = Array.isArray(order.services)
      ? order.services.filter((row): row is Record<string, unknown> =>
          Boolean(row && typeof row === "object"),
        )
      : [];
    const actualCodes = serviceRows.map((row) => asText(row.item)).sort();
    const servicesMatch =
      expectedServiceCodes.length === actualCodes.length &&
      expectedServiceCodes.every((code, index) => code === actualCodes[index]);
    const snapshotsValid = serviceRows.every(
      (row) =>
        asText(row.item).length > 0 &&
        asText(row.item_code_snapshot) === asText(row.item) &&
        asText(row.item_name_snapshot).length > 0 &&
        Number(row.qty) > 0,
    );
    const actualTotal = Number(order.agreed_gross_total ?? 0);

    return (
      asText(order.name) === orderId &&
      asText(order.booking_id) === bookingId &&
      asText(order.customer) === customerId &&
      asText(order.vehicle) === vehicleId &&
      asText(order.service_date).slice(0, 10) === serviceDate.slice(0, 10) &&
      asBoolean(order.date_only) &&
      !order.handover_time &&
      servicesMatch &&
      snapshotsValid &&
      Number.isFinite(actualTotal) &&
      Math.abs(actualTotal - agreedTotal) < 0.005 &&
      asText(order.payment_status) === paymentStatus &&
      !order.sales_invoice
    );
  };

  const loadVehicleByPlate = async (normalizedPlate: string) =>
    listRows(
      VEHICLE_DOCTYPE,
      ["name", "customer", "registration_plate_normalized", "external_reference"],
      [["registration_plate_normalized", "=", normalizedPlate]],
      2,
    );

  const loadOrderByBooking = async (id: string) =>
    listRows(
      ORDER_DOCTYPE,
      ["name", "booking_id", "customer", "vehicle", "status"],
      [["booking_id", "=", id]],
      2,
    );

  const persistFailure = async (code: string, status: number | null = null) => {
    try {
      await supabase
        .from("booking_automation_state")
        .update({
          erpnext_processing_at: null,
          erpnext_last_error: code,
          erpnext_last_http_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("booking_id", bookingId);
    } catch {
      // Preserve the original synchronization failure.
    }
  };

  let syncClaimed = false;

  try {
    const auth = await erpRequest("GET", "/api/method/frappe.auth.get_logged_user");
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

    const { data: state, error: stateError } = await supabase
      .from("booking_automation_state")
      .select("erpnext_customer_id, erpnext_vehicle_id, erpnext_order_id, erpnext_last_error")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (stateError) return json({ ok: false, error: "booking_state_load_failed" }, 500);
    if (state?.erpnext_last_error) {
      return json({ ok: false, error: "erpnext_sync_requires_manual_review" }, 409);
    }

    const customerId =
      typeof state?.erpnext_customer_id === "string" ? state.erpnext_customer_id : "";
    if (!customerId) return json({ ok: false, error: "customer_not_synced" }, 409);

    const normalizedEmail = normalizeEmail(String(booking.customer_email ?? ""));
    const { data: mapping, error: mappingError } = await supabase
      .from("erpnext_customer_mappings")
      .select("erpnext_customer_id, erpnext_contact_id, synced_at, last_error")
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();
    if (mappingError) return json({ ok: false, error: "customer_mapping_load_failed" }, 500);
    if (!mapping?.synced_at || mapping.last_error || mapping.erpnext_customer_id !== customerId) {
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

    const serviceDate = String(booking.booking_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}/.test(serviceDate)) {
      return json({ ok: false, error: "invalid_service_date" }, 409);
    }
    const agreedTotal = Number(booking.agreed_price ?? booking.total ?? 0);
    if (!Number.isFinite(agreedTotal) || agreedTotal < 0) {
      return json({ ok: false, error: "invalid_agreed_total" }, 409);
    }
    const paymentStatus = booking.status === "Bezahlt" ? "Bezahlt" : "Ausstehend";
    const expectedServiceCodes = serviceChecks.map((service) => service.code).sort();

    const customerRows = await listRows("Customer", ["name"], [["name", "=", customerId]], 2);
    if (customerRows.length !== 1) {
      return json({ ok: false, error: "mapped_customer_missing_in_erpnext" }, 409);
    }

    let vehicleRows = await loadVehicleByPlate(normalizedPlate);
    if (vehicleRows.length > 1) {
      return json({ ok: false, error: "multiple_vehicle_plate_matches" }, 409);
    }
    if (vehicleRows[0] && vehicleRows[0].customer !== customerId) {
      return json({ ok: false, error: "vehicle_customer_conflict" }, 409);
    }

    let orderRows = await loadOrderByBooking(bookingId);
    if (orderRows.length > 1) {
      return json({ ok: false, error: "multiple_booking_order_matches" }, 409);
    }

    const existingOrder = orderRows[0] ?? null;
    const existingVehicle = vehicleRows[0] ?? null;
    if (existingOrder && existingOrder.customer !== customerId) {
      return json({ ok: false, error: "order_customer_conflict" }, 409);
    }
    if (existingOrder && !existingVehicle) {
      await persistFailure("existing_order_without_exact_vehicle_match");
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

    if (existingOrder && existingVehicle) {
      const existingVehicleId = asText(existingVehicle.name);
      const existingOrderId = asText(existingOrder.name);
      if (!existingVehicleId || !existingOrderId) {
        await persistFailure("existing_erpnext_identity_invalid");
        return json({ ok: false, error: "existing_erpnext_identity_invalid" }, 409);
      }
      const [vehicleVerified, orderVerified] = await Promise.all([
        verifyPersistedVehicle(existingVehicleId, customerId, normalizedPlate),
        verifyPersistedOrder({
          orderId: existingOrderId,
          bookingId,
          customerId,
          vehicleId: existingVehicleId,
          serviceDate,
          expectedServiceCodes,
          agreedTotal,
          paymentStatus,
        }),
      ]);
      if (!vehicleVerified || !orderVerified) {
        await persistFailure("existing_erpnext_pair_verification_failed");
        return json({ ok: false, error: "existing_erpnext_pair_verification_failed" }, 409);
      }

      const now = new Date().toISOString();
      const { data: reconciledState, error: reconcileError } = await supabase
        .from("booking_automation_state")
        .update({
          erpnext_vehicle_id: existingVehicleId,
          erpnext_order_id: existingOrderId,
          erpnext_processing_at: null,
          erpnext_synced_at: now,
          erpnext_last_error: null,
          erpnext_last_http_status: 200,
          updated_at: now,
        })
        .eq("booking_id", bookingId)
        .select("booking_id")
        .maybeSingle();
      if (reconcileError || !reconciledState) {
        return json({ ok: false, error: "sync_state_reconcile_failed" }, 500);
      }
      return json({
        ok: true,
        writes_performed: false,
        idempotent_reuse: true,
        vehicle_id: existingVehicleId,
        order_id: existingOrderId,
        financial_writes: false,
      });
    }

    const { data: claimed, error: claimError } = await supabase.rpc("claim_erpnext_booking_sync", {
      p_booking_id: bookingId,
      p_ttl_minutes: 10,
    });
    if (claimError) return json({ ok: false, error: "booking_claim_failed" }, 500);
    if (!claimed) return json({ ok: false, error: "booking_sync_busy_or_blocked" }, 409);
    syncClaimed = true;

    vehicleRows = await loadVehicleByPlate(normalizedPlate);
    if (vehicleRows.length > 1) {
      await persistFailure("multiple_vehicle_plate_matches");
      return json({ ok: false, error: "multiple_vehicle_plate_matches" }, 409);
    }
    if (vehicleRows[0] && vehicleRows[0].customer !== customerId) {
      await persistFailure("vehicle_customer_conflict");
      return json({ ok: false, error: "vehicle_customer_conflict" }, 409);
    }

    orderRows = await loadOrderByBooking(bookingId);
    if (orderRows.length > 1) {
      await persistFailure("multiple_booking_order_matches");
      return json({ ok: false, error: "multiple_booking_order_matches" }, 409);
    }
    if (orderRows[0] && orderRows[0].customer !== customerId) {
      await persistFailure("order_customer_conflict");
      return json({ ok: false, error: "order_customer_conflict" }, 409);
    }
    if (orderRows[0] && !vehicleRows[0]) {
      await persistFailure("existing_order_without_exact_vehicle_match");
      return json({ ok: false, error: "existing_order_without_exact_vehicle_match" }, 409);
    }
    if (
      orderRows[0] &&
      typeof orderRows[0].vehicle === "string" &&
      orderRows[0].vehicle !== vehicleRows[0]?.name
    ) {
      await persistFailure("order_vehicle_conflict");
      return json({ ok: false, error: "order_vehicle_conflict" }, 409);
    }

    let vehicleId = typeof vehicleRows[0]?.name === "string" ? vehicleRows[0].name : "";
    let vehicleCreated = false;

    if (!vehicleId) {
      const vehicleClassId = String(booking.vehicle_id ?? "");
      const vehicleClassLabel = vehicleClassLabels[vehicleClassId] ?? vehicleClassId;
      let created: ErpResult | null = null;
      try {
        created = await erpRequest("POST", `/api/resource/${encodeURIComponent(VEHICLE_DOCTYPE)}`, {
          customer: customerId,
          registration_plate: plate,
          registration_plate_normalized: normalizedPlate,
          vehicle_class_id: vehicleClassId,
          vehicle_class_label: vehicleClassLabel,
          external_reference: `plate:${normalizedPlate}`,
        });
      } catch {
        created = null;
      }

      if (
        created?.response.ok &&
        created.isJson &&
        created.payload &&
        typeof created.payload === "object"
      ) {
        const data = (created.payload as { data?: { name?: unknown } }).data;
        vehicleId = data && typeof data.name === "string" ? data.name : "";
      }

      if (!vehicleId) {
        const verifyRows = await loadVehicleByPlate(normalizedPlate);
        if (
          verifyRows.length === 1 &&
          verifyRows[0].customer === customerId &&
          typeof verifyRows[0].name === "string"
        ) {
          vehicleId = verifyRows[0].name;
        } else {
          const status = created?.response.status ?? null;
          await persistFailure("uncertain_vehicle_create", status);
          return json({ ok: false, error: "uncertain_vehicle_create" }, 502);
        }
      } else {
        vehicleCreated = true;
      }
    }

    if (!(await verifyPersistedVehicle(vehicleId, customerId, normalizedPlate))) {
      await persistFailure("vehicle_post_write_verification_failed");
      return json({ ok: false, error: "vehicle_post_write_verification_failed" }, 502);
    }

    orderRows = await loadOrderByBooking(bookingId);
    if (orderRows.length > 1) {
      await persistFailure("multiple_booking_order_matches");
      return json({ ok: false, error: "multiple_booking_order_matches" }, 409);
    }
    if (orderRows[0] && orderRows[0].customer !== customerId) {
      await persistFailure("order_customer_conflict");
      return json({ ok: false, error: "order_customer_conflict" }, 409);
    }
    if (
      orderRows[0] &&
      typeof orderRows[0].vehicle === "string" &&
      orderRows[0].vehicle !== vehicleId
    ) {
      await persistFailure("order_vehicle_conflict");
      return json({ ok: false, error: "order_vehicle_conflict" }, 409);
    }

    let orderId = typeof orderRows[0]?.name === "string" ? orderRows[0].name : "";
    let orderCreated = false;

    if (!orderId) {
      const services = serviceChecks.map((service) => ({
        item: service.code,
        item_code_snapshot: service.code,
        item_name_snapshot: service.item_name ?? service.label,
        service_kind: service.kind,
        qty: 1,
      }));

      let created: ErpResult | null = null;
      try {
        created = await erpRequest("POST", `/api/resource/${encodeURIComponent(ORDER_DOCTYPE)}`, {
          customer: customerId,
          vehicle: vehicleId,
          booking_id: bookingId,
          source_reference: booking.invoice_number,
          status: "Bestätigt",
          service_date: serviceDate,
          date_only: 1,
          handover_time: null,
          pickup_city: booking.pickup_city,
          preferred_contact: booking.preferred_contact,
          booking_source: booking.booking_source,
          services,
          agreed_gross_total: agreedTotal,
          payment_status: paymentStatus,
        });
      } catch {
        created = null;
      }

      if (
        created?.response.ok &&
        created.isJson &&
        created.payload &&
        typeof created.payload === "object"
      ) {
        const data = (created.payload as { data?: { name?: unknown } }).data;
        orderId = data && typeof data.name === "string" ? data.name : "";
      }

      if (!orderId) {
        const verifyRows = await loadOrderByBooking(bookingId);
        if (
          verifyRows.length === 1 &&
          verifyRows[0].customer === customerId &&
          verifyRows[0].vehicle === vehicleId &&
          typeof verifyRows[0].name === "string"
        ) {
          orderId = verifyRows[0].name;
        } else {
          const status = created?.response.status ?? null;
          await persistFailure("uncertain_order_create", status);
          return json({ ok: false, error: "uncertain_order_create" }, 502);
        }
      } else {
        orderCreated = true;
      }
    }

    const orderVerified = await verifyPersistedOrder({
      orderId,
      bookingId,
      customerId,
      vehicleId,
      serviceDate,
      expectedServiceCodes,
      agreedTotal,
      paymentStatus,
    });
    if (!orderVerified) {
      await persistFailure("order_post_write_verification_failed");
      return json({ ok: false, error: "order_post_write_verification_failed" }, 502);
    }

    const now = new Date().toISOString();
    const { data: updatedState, error: stateUpdateError } = await supabase
      .from("booking_automation_state")
      .update({
        erpnext_vehicle_id: vehicleId,
        erpnext_order_id: orderId,
        erpnext_processing_at: null,
        erpnext_synced_at: now,
        erpnext_last_error: null,
        erpnext_last_http_status: 200,
        updated_at: now,
      })
      .eq("booking_id", bookingId)
      .select("booking_id")
      .maybeSingle();
    if (stateUpdateError || !updatedState) {
      await persistFailure("sync_state_update_failed_after_erpnext_write");
      return json({ ok: false, error: "sync_state_update_failed_after_erpnext_write" }, 500);
    }

    return json({
      ok: true,
      writes_performed: vehicleCreated || orderCreated,
      idempotent_reuse: !vehicleCreated && !orderCreated,
      vehicle_created: vehicleCreated,
      order_created: orderCreated,
      vehicle_id: vehicleId,
      order_id: orderId,
      financial_writes: false,
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    const code = timeout
      ? "erpnext_timeout"
      : error instanceof Error
        ? error.message
        : "erpnext_vehicle_order_write_failed";
    if (syncClaimed) await persistFailure(code);
    return json({ ok: false, error: code }, 502);
  }
});
