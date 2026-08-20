import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestBody = {
  bookingId?: unknown;
  mode?: unknown;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = Deno.env.get("ERPNEXT_BASE_URL")?.replace(/\/$/, "");
  const apiKey = Deno.env.get("ERPNEXT_API_KEY");
  const apiSecret = Deno.env.get("ERPNEXT_API_SECRET");

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
        message: "ERPNext writes remain disabled until the readiness and idempotency gates pass.",
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

  try {
    const authResponse = await fetch(`${baseUrl}/api/method/frappe.auth.get_logged_user`, {
      headers: {
        Authorization: `token ${apiKey}:${apiSecret}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!authResponse.ok) {
      return json(
        {
          ok: false,
          error: "erpnext_auth_failed",
          upstream_status: authResponse.status,
        },
        502,
      );
    }
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return json({ ok: false, error: timeout ? "erpnext_timeout" : "erpnext_unreachable" }, 502);
  }

  return json({
    ok: true,
    mode: "preview",
    booking_id: booking.id,
    mapping: {
      customer: {
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone,
      },
      vehicle: {
        plate: booking.customer_plate,
        category_id: booking.vehicle_id,
      },
      order: {
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
});
