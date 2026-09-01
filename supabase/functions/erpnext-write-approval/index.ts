import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

import { verifyCustomerWriteConfirmation } from "../_shared/erpnextCustomerWriteGate.ts";
import { verifyVehicleOrderWriteConfirmation } from "../_shared/erpnextVehicleOrderWriteGate.ts";

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
const APPROVAL_TTL_SECONDS = 5 * 60;

type ApprovalScope = "customer" | "vehicle_order";

type RequestBody = {
  bookingId?: unknown;
  scope?: unknown;
  confirmation?: unknown;
};

const isEnabled = (value: string | undefined) => value?.trim().toLowerCase() === "true";

const isApprovalScope = (value: unknown): value is ApprovalScope =>
  value === "customer" || value === "vehicle_order";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: "missing_server_configuration" }, 500);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "authentication_required" }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);
  if (userError || !user) return json({ ok: false, error: "invalid_session" }, 401);

  const { data: role, error: roleError } = await serviceClient
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
  if (!isApprovalScope(body.scope)) {
    return json({ ok: false, error: "invalid_approval_scope" }, 400);
  }
  if (typeof body.confirmation !== "string" || !body.confirmation.trim()) {
    return json({ ok: false, error: "approval_confirmation_required" }, 400);
  }

  const writeEnabled =
    body.scope === "customer"
      ? isEnabled(Deno.env.get("ERPNEXT_CUSTOMER_WRITE_ENABLED"))
      : isEnabled(Deno.env.get("ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED"));
  if (!writeEnabled) {
    return json(
      {
        ok: false,
        error:
          body.scope === "customer"
            ? "customer_write_gate_disabled"
            : "production_write_gate_disabled",
      },
      409,
    );
  }

  const { data: booking, error: bookingError } = await serviceClient
    .from("bookings")
    .select("id, status, updated_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) return json({ ok: false, error: "booking_load_failed" }, 500);
  if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);
  if (!ELIGIBLE_STATUSES.has(String(booking.status ?? ""))) {
    return json({ ok: false, error: "booking_not_approval_eligible" }, 409);
  }

  const bookingRevision = String(booking.updated_at ?? "");
  if (!bookingRevision) return json({ ok: false, error: "booking_revision_missing" }, 409);

  const confirmationValid =
    body.scope === "customer"
      ? await verifyCustomerWriteConfirmation({
          secret: serviceRoleKey,
          bookingId: booking.id,
          bookingRevision,
          approvalId: null,
          confirmation: body.confirmation,
        })
      : await verifyVehicleOrderWriteConfirmation({
          secret: serviceRoleKey,
          bookingId: booking.id,
          bookingRevision,
          approvalId: null,
          confirmation: body.confirmation,
        });
  if (!confirmationValid) {
    return json({ ok: false, error: "approval_confirmation_invalid" }, 409);
  }

  const { data: approvalId, error: approvalError } = await serviceClient.rpc(
    "create_erpnext_write_approval",
    {
      p_booking_id: booking.id,
      p_booking_revision: bookingRevision,
      p_scope: body.scope,
      p_approved_by: user.id,
      p_ttl_seconds: APPROVAL_TTL_SECONDS,
    },
  );
  if (approvalError) return json({ ok: false, error: "approval_create_failed" }, 500);
  if (typeof approvalId !== "string" || !UUID_RE.test(approvalId)) {
    return json({ ok: false, error: "approval_not_created" }, 409);
  }

  const { data: approval, error: approvalLoadError } = await serviceClient
    .from("erpnext_write_approvals")
    .select("id, scope, expires_at")
    .eq("id", approvalId)
    .maybeSingle();
  if (approvalLoadError || !approval) {
    return json({ ok: false, error: "approval_metadata_load_failed" }, 500);
  }

  return json({
    ok: true,
    approval: {
      id: approval.id,
      scope: approval.scope,
      expires_at: approval.expires_at,
    },
  });
});
