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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestBody = {
  bookingId?: unknown;
  mode?: unknown;
};

type ProbeResult = {
  ok: boolean;
  status: number | null;
  expected_found?: boolean;
};

type FetchResult = {
  response: Response;
  payload: unknown;
  isJson: boolean;
  location: string | null;
};

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
  const companyName = Deno.env.get("ERPNEXT_COMPANY")?.trim() || "White-Gloss";

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

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!UUID_RE.test(bookingId)) return json({ ok: false, error: "invalid_booking_id" }, 400);

  const mode = body.mode === "commit" ? "commit" : "preview";
  if (mode === "commit") {
    return json(
      {
        ok: false,
        error: "commit_not_enabled",
        message: "ERPNext writes remain disabled until the read/write and idempotency gates pass.",
      },
      409,
    );
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, invoice_number, vehicle_id, package_id, add_on_ids, booking_date, booking_time, pickup_city, customer_name, customer_email, customer_phone, customer_plate, preferred_contact, total, agreed_price, status, booking_source, notes",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) return json({ ok: false, error: "booking_load_failed" }, 500);
  if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);

  const erpHeaders = {
    Authorization: `token ${apiKey}:${apiSecret}`,
    Accept: "application/json",
  };

  const getJson = async (path: string): Promise<FetchResult> => {
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

  const probeDoctype = async (
    doctype: string,
    expectedName?: string,
  ): Promise<ProbeResult> => {
    try {
      const fields = encodeURIComponent(JSON.stringify(["name"]));
      const result = await getJson(
        `/api/resource/${encodeURIComponent(doctype)}?fields=${fields}&limit_page_length=100`,
      );
      if (!result.response.ok || !result.isJson) {
        return { ok: false, status: result.response.status };
      }

      const payload = result.payload as { data?: unknown } | null;
      if (!payload || !Array.isArray(payload.data)) {
        return { ok: false, status: result.response.status };
      }

      const names = payload.data
        .map((row: unknown) =>
          row && typeof row === "object" && "name" in row && typeof row.name === "string"
            ? row.name
            : "",
        )
        .filter(Boolean);

      return {
        ok: true,
        status: result.response.status,
        ...(expectedName ? { expected_found: names.includes(expectedName) } : {}),
      };
    } catch {
      return { ok: false, status: null };
    }
  };

  try {
    const auth = await getJson("/api/method/frappe.auth.get_logged_user");
    if (!auth.response.ok) {
      return json(
        {
          ok: false,
          error: "erpnext_auth_failed",
          upstream_status: auth.response.status,
        },
        502,
      );
    }

    if (!auth.isJson) {
      return json(
        {
          ok: false,
          error: auth.location ? "erpnext_redirected" : "erpnext_invalid_response",
          upstream_status: auth.response.status,
        },
        502,
      );
    }

    const authPayload = auth.payload as { message?: unknown } | null;
    const authenticated = Boolean(
      authPayload &&
        typeof authPayload.message === "string" &&
        authPayload.message.length > 0 &&
        authPayload.message !== "Guest",
    );
    if (!authenticated) {
      return json({ ok: false, error: "erpnext_auth_unconfirmed" }, 502);
    }

    const [company, customer, contact, address, item, customerGroup, territory] =
      await Promise.all([
        probeDoctype("Company", companyName),
        probeDoctype("Customer"),
        probeDoctype("Contact"),
        probeDoctype("Address"),
        probeDoctype("Item"),
        probeDoctype("Customer Group", "Individual"),
        probeDoctype("Territory", "All Territories"),
      ]);

    const readReady =
      company.ok &&
      company.expected_found === true &&
      customer.ok &&
      contact.ok &&
      address.ok &&
      item.ok &&
      customerGroup.ok &&
      customerGroup.expected_found === true &&
      territory.ok &&
      territory.expected_found === true;

    return json({
      ok: true,
      mode: "preview",
      booking_id: booking.id,
      erpnext: {
        authenticated: true,
        company: companyName,
        read_ready: readReady,
        checks: {
          company,
          customer,
          contact,
          address,
          item,
          customer_group: customerGroup,
          territory,
        },
        writes_enabled: false,
      },
      mapping: {
        customer: {
          name: booking.customer_name,
          email: booking.customer_email,
          phone: booking.customer_phone,
          customer_group: "Individual",
          territory: "All Territories",
        },
        vehicle: {
          plate: booking.customer_plate,
          category_id: booking.vehicle_id,
        },
        order: {
          company: companyName,
          external_reference: booking.invoice_number,
          service_date: booking.booking_date,
          date_only: !booking.booking_time,
          package_id: booking.package_id,
          add_on_ids: booking.add_on_ids,
          pickup_city: booking.pickup_city,
          preferred_contact: booking.preferred_contact,
          source: booking.booking_source,
          status: booking.status,
          gross_total: booking.agreed_price ?? booking.total,
        },
      },
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return json({ ok: false, error: timeout ? "erpnext_timeout" : "erpnext_unreachable" }, 502);
  }
});
