import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

import {
  evaluateCustomerWriteGate,
  getCustomerWriteGateStatus,
  issueCustomerWriteConfirmation,
  verifyCustomerWriteConfirmation,
} from "../_shared/erpnextCustomerWriteGate.ts";
import {
  completeCustomerSyncDurably,
  createCustomerDurably,
} from "../_shared/erpnextCustomerSyncDurability.ts";

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
const COMMIT_STATUSES = new Set(["Bestätigt", "Bezahlt"]);
const CUSTOMER_SYNC_LEASE_SECONDS = 15 * 60;

type RequestBody = {
  bookingId?: unknown;
  mode?: unknown;
  confirmation?: unknown;
};

type ErpResponse = {
  response: Response;
  payload: unknown;
  isJson: boolean;
  location: string | null;
};

type CustomerMapping = {
  normalized_email: string;
  source_name: string | null;
  erpnext_customer_id: string | null;
  erpnext_contact_id: string | null;
  processing_at: string | null;
  processing_token: string | null;
  synced_at: string | null;
  last_error: string | null;
  last_http_status: number | null;
  attempts: number;
};

type ContactMatch = {
  contactId: string;
  customerId: string;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const splitName = (value: string) => {
  const parts = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "Kunde", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
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
  const writeEnabled = Deno.env.get("ERPNEXT_CUSTOMER_WRITE_ENABLED") === "true";
  const approvedBookingId = Deno.env.get("ERPNEXT_CUSTOMER_APPROVED_BOOKING_ID")?.trim() ?? "";

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

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, customer_name, customer_email, customer_phone, status, updated_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) return json({ ok: false, error: "booking_load_failed" }, 500);
  if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);

  const normalizedEmail = normalizeEmail(String(booking.customer_email ?? ""));
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return json({ ok: false, error: "booking_email_invalid" }, 409);
  }

  if (mode === "commit" && !COMMIT_STATUSES.has(String(booking.status ?? ""))) {
    return json({ ok: false, error: "booking_not_commit_eligible" }, 409);
  }

  const bookingRevision = String(booking.updated_at ?? "");
  if (!bookingRevision) return json({ ok: false, error: "booking_revision_missing" }, 409);

  const gateStatus = getCustomerWriteGateStatus({
    enabledValue: writeEnabled ? "true" : "false",
    approvedBookingId,
    bookingId,
  });

  if (mode === "commit") {
    const confirmationValid = await verifyCustomerWriteConfirmation({
      secret: serviceRoleKey,
      bookingId,
      bookingRevision,
      confirmation: body.confirmation,
    });
    const gate = evaluateCustomerWriteGate({
      enabledValue: writeEnabled ? "true" : "false",
      approvedBookingId,
      bookingId,
      confirmationValid,
    });
    if (!gate.ready) return json({ ok: false, error: gate.error }, 409);
  }

  const previewResponse = async (customerState: string) => {
    const confirmation = gateStatus.ready
      ? await issueCustomerWriteConfirmation({
          secret: serviceRoleKey,
          bookingId,
          bookingRevision,
        })
      : null;

    return json({
      ok: true,
      mode: "preview",
      booking_id: booking.id,
      writes_enabled: gateStatus.enabled,
      customer_state: customerState,
      production_write: {
        enabled: gateStatus.enabled,
        booking_approved: gateStatus.bookingApproved,
        ready: gateStatus.ready,
        confirmation,
      },
    });
  };

  const erpHeaders = {
    Authorization: `token ${apiKey}:${apiSecret}`,
    Accept: "application/json",
  };

  const erpRequest = async (
    method: "GET" | "POST",
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<ErpResponse> => {
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

  const loadMapping = async (): Promise<CustomerMapping | null> => {
    const { data, error } = await supabase
      .from("erpnext_customer_mappings")
      .select(
        "normalized_email, source_name, erpnext_customer_id, erpnext_contact_id, processing_at, processing_token, synced_at, last_error, last_http_status, attempts",
      )
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();
    if (error) throw new Error("mapping_load_failed");
    return (data as CustomerMapping | null) ?? null;
  };

  let syncToken = "";

  const updateMapping = async (values: Record<string, unknown>) => {
    if (!syncToken) throw new Error("customer_sync_lease_missing");
    const { data, error } = await supabase
      .from("erpnext_customer_mappings")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("normalized_email", normalizedEmail)
      .eq("processing_token", syncToken)
      .select("normalized_email")
      .maybeSingle();
    if (error || !data) throw new Error("customer_sync_lease_lost");
  };

  const releaseBookingLease = async () => {
    if (!syncToken) return true;
    const { data, error } = await supabase
      .from("booking_automation_state")
      .update({
        erpnext_customer_processing_at: null,
        erpnext_customer_processing_expires_at: null,
        erpnext_customer_processing_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("booking_id", booking.id)
      .eq("erpnext_customer_processing_token", syncToken)
      .select("booking_id")
      .maybeSingle();
    return !error && Boolean(data);
  };

  const assertCustomerSyncLease = async () => {
    if (!syncToken) throw new Error("customer_sync_lease_missing");

    const now = new Date().toISOString();
    const [bookingLease, mappingLease] = await Promise.all([
      supabase
        .from("booking_automation_state")
        .select("booking_id")
        .eq("booking_id", booking.id)
        .eq("erpnext_customer_processing_token", syncToken)
        .gt("erpnext_customer_processing_expires_at", now)
        .maybeSingle(),
      supabase
        .from("erpnext_customer_mappings")
        .select("normalized_email")
        .eq("normalized_email", normalizedEmail)
        .eq("processing_token", syncToken)
        .maybeSingle(),
    ]);

    if (bookingLease.error || mappingLease.error || !bookingLease.data || !mappingLease.data) {
      throw new Error("customer_sync_lease_lost_before_write");
    }
  };

  const upsertBookingCustomerId = async (customerId: string) => {
    const { error } = await supabase.from("booking_automation_state").upsert(
      {
        booking_id: booking.id,
        erpnext_customer_id: customerId,
      },
      { onConflict: "booking_id" },
    );
    if (error) throw new Error("booking_mapping_update_failed");
  };

  const findContactByExactEmail = async (): Promise<ContactMatch | null> => {
    const fields = encodeURIComponent(JSON.stringify(["name", "email_id"]));
    const filters = encodeURIComponent(JSON.stringify([["email_id", "=", normalizedEmail]]));
    const list = await erpRequest(
      "GET",
      `/api/resource/Contact?fields=${fields}&filters=${filters}&limit_page_length=3`,
    );
    if (!list.response.ok || !list.isJson) throw new Error("contact_lookup_failed");

    const rows =
      list.payload &&
      typeof list.payload === "object" &&
      Array.isArray((list.payload as { data?: unknown }).data)
        ? (list.payload as { data: Array<{ name?: unknown }> }).data
        : null;
    if (!rows) throw new Error("contact_lookup_invalid_response");
    if (rows.length === 0) return null;
    if (rows.length > 1) throw new Error("multiple_exact_email_contacts");

    const contactId = typeof rows[0]?.name === "string" ? rows[0].name : "";
    if (!contactId) throw new Error("contact_lookup_invalid_name");

    const detail = await erpRequest(
      "GET",
      `/api/resource/Contact/${encodeURIComponent(contactId)}`,
    );
    if (!detail.response.ok || !detail.isJson) throw new Error("contact_detail_failed");
    const data =
      detail.payload && typeof detail.payload === "object"
        ? (detail.payload as { data?: { links?: unknown } }).data
        : null;
    const links = data && Array.isArray(data.links) ? data.links : [];
    const customerLinks = links
      .filter(
        (link: unknown) =>
          link &&
          typeof link === "object" &&
          (link as { link_doctype?: unknown }).link_doctype === "Customer" &&
          typeof (link as { link_name?: unknown }).link_name === "string",
      )
      .map((link: unknown) => (link as { link_name: string }).link_name);

    if (customerLinks.length !== 1) {
      throw new Error(
        customerLinks.length === 0
          ? "email_contact_without_customer_link"
          : "email_contact_has_multiple_customer_links",
      );
    }

    return { contactId, customerId: customerLinks[0] };
  };

  const persistFailure = async (code: string, status: number | null = null) => {
    try {
      await updateMapping({
        processing_at: null,
        processing_token: null,
        last_error: code,
        last_http_status: status,
      });
      return await releaseBookingLease();
    } catch {
      await releaseBookingLease();
      return false;
    }
  };

  const failWithReviewState = async (
    code: string,
    responseStatus: number,
    upstreamStatus: number | null = null,
  ) => {
    if (await persistFailure(code, upstreamStatus)) {
      return json({ ok: false, error: code, upstream_status: upstreamStatus }, responseStatus);
    }
    return json(
      {
        ok: false,
        error: "customer_sync_failure_persist_failed",
        operation_error: code,
        upstream_status: upstreamStatus,
      },
      500,
    );
  };

  try {
    const auth = await erpRequest("GET", "/api/method/frappe.auth.get_logged_user");
    if (!auth.response.ok || !auth.isJson || auth.location) {
      return json(
        {
          ok: false,
          error: "erpnext_auth_failed",
          upstream_status: auth.response.status,
        },
        502,
      );
    }

    const authPayload = auth.payload as { message?: unknown } | null;
    if (
      !authPayload ||
      typeof authPayload.message !== "string" ||
      authPayload.message === "Guest"
    ) {
      return json({ ok: false, error: "erpnext_auth_unconfirmed" }, 502);
    }

    let mapping = await loadMapping();
    if (mapping?.last_error) {
      return json({ ok: false, error: "customer_mapping_requires_manual_review" }, 409);
    }
    if (mapping?.synced_at && mapping.erpnext_customer_id && mapping.erpnext_contact_id) {
      if (mode === "preview") return await previewResponse("already_synced");
      return json({
        ok: true,
        mode,
        booking_id: booking.id,
        writes_enabled: true,
        customer_state: "already_synced",
      });
    }

    let exactContact: ContactMatch | null = null;
    try {
      exactContact = await findContactByExactEmail();
    } catch (error) {
      const code = error instanceof Error ? error.message : "contact_lookup_failed";
      if (
        code === "multiple_exact_email_contacts" ||
        code === "email_contact_without_customer_link" ||
        code === "email_contact_has_multiple_customer_links"
      ) {
        return json({ ok: false, error: code }, 409);
      }
      return json({ ok: false, error: code }, 502);
    }

    if (mapping?.erpnext_customer_id && exactContact) {
      if (mapping.erpnext_customer_id !== exactContact.customerId) {
        return json({ ok: false, error: "customer_mapping_conflict" }, 409);
      }
      if (mode === "preview") {
        return await previewResponse("existing_mapping_and_contact");
      }
    }

    if (!mapping?.erpnext_customer_id && exactContact && mode === "preview") {
      return await previewResponse("existing_exact_email_contact");
    }

    if (mode === "preview") {
      return await previewResponse(
        mapping?.erpnext_customer_id
          ? "contact_create_needed"
          : "customer_and_contact_create_needed",
      );
    }

    const { data: claimedToken, error: claimError } = await supabase.rpc(
      "claim_erpnext_customer_booking_sync",
      {
        p_booking_id: bookingId,
        p_booking_revision: bookingRevision,
        p_normalized_email: normalizedEmail,
        p_ttl_seconds: CUSTOMER_SYNC_LEASE_SECONDS,
      },
    );
    if (claimError) return json({ ok: false, error: "customer_claim_failed" }, 500);
    if (typeof claimedToken !== "string" || !claimedToken) {
      return json({ ok: false, error: "customer_sync_busy_blocked_or_revision_changed" }, 409);
    }
    syncToken = claimedToken;

    mapping = await loadMapping();
    if (!mapping || mapping.processing_token !== syncToken) {
      return await failWithReviewState("mapping_missing_after_claim", 500);
    }
    if (mapping.last_error) {
      return await failWithReviewState("customer_mapping_requires_manual_review", 409);
    }

    try {
      exactContact = await findContactByExactEmail();
    } catch (error) {
      const code = error instanceof Error ? error.message : "contact_lookup_failed";
      return await failWithReviewState(code, 409);
    }

    let customerId = mapping.erpnext_customer_id;
    let contactId = mapping.erpnext_contact_id;

    if (exactContact) {
      if (customerId && customerId !== exactContact.customerId) {
        return await failWithReviewState("customer_mapping_conflict", 409);
      }
      customerId = exactContact.customerId;
      contactId = exactContact.contactId;
      // Festgehalten, bevor die Rückrufe gebaut werden: eine später
      // veränderte Variable würde sonst eine andere ID schreiben als die
      // hier geprüfte — und der Typ ließe auch `null` durch.
      const matchedCustomerId = exactContact.customerId;
      const matchedContactId = exactContact.contactId;
      await completeCustomerSyncDurably({
        persistBookingCustomerId: () => upsertBookingCustomerId(matchedCustomerId),
        publishMappingSynced: () =>
          updateMapping({
            source_name: booking.customer_name,
            erpnext_customer_id: matchedCustomerId,
            erpnext_contact_id: matchedContactId,
            processing_at: null,
            processing_token: null,
            synced_at: new Date().toISOString(),
            last_error: null,
            last_http_status: 200,
          }),
      });
      if (!(await releaseBookingLease())) {
        return json({ ok: false, error: "customer_booking_lease_release_failed" }, 500);
      }
      return json({
        ok: true,
        mode,
        booking_id: booking.id,
        writes_enabled: true,
        customer_state: "reused_exact_email_contact",
      });
    }

    if (!customerId) {
      let created: ErpResponse;
      try {
        created = await createCustomerDurably({
          assertLease: assertCustomerSyncLease,
          persistUncertainIntent: (marker) =>
            updateMapping({
              last_error: marker,
              last_http_status: null,
            }),
          createCustomer: () =>
            erpRequest("POST", "/api/resource/Customer", {
              customer_name: String(booking.customer_name ?? "").trim() || "Kunde",
              customer_type: "Individual",
              customer_group: "Individual",
              territory: "All Territories",
            }),
        });
      } catch {
        return await failWithReviewState("uncertain_customer_create_network", 502);
      }

      if (!created.response.ok || !created.isJson) {
        const code =
          created.response.status >= 500
            ? "uncertain_customer_create_upstream"
            : "customer_create_rejected";
        return await failWithReviewState(
          code,
          created.response.status >= 500 ? 502 : 409,
          created.response.status,
        );
      }

      const createdData =
        created.payload && typeof created.payload === "object"
          ? (created.payload as { data?: { name?: unknown } }).data
          : null;
      customerId = createdData && typeof createdData.name === "string" ? createdData.name : "";
      if (!customerId) {
        return await failWithReviewState(
          "uncertain_customer_create_missing_id",
          502,
          created.response.status,
        );
      }

      await updateMapping({
        source_name: booking.customer_name,
        erpnext_customer_id: customerId,
        last_error: null,
        last_http_status: created.response.status,
      });
      await upsertBookingCustomerId(customerId);
    }

    if (!contactId) {
      await assertCustomerSyncLease();
      const { firstName, lastName } = splitName(String(booking.customer_name ?? ""));
      const phone = String(booking.customer_phone ?? "").trim();
      const contactPayload: Record<string, unknown> = {
        first_name: firstName,
        ...(lastName ? { last_name: lastName } : {}),
        email_ids: [{ email_id: normalizedEmail, is_primary: 1 }],
        links: [{ link_doctype: "Customer", link_name: customerId }],
        is_primary_contact: 1,
      };
      if (phone) {
        contactPayload.phone_nos = [
          {
            phone,
            is_primary_phone: 1,
            is_primary_mobile_no: 1,
          },
        ];
      }

      let createdContact: ErpResponse;
      try {
        createdContact = await erpRequest("POST", "/api/resource/Contact", contactPayload);
      } catch {
        return await failWithReviewState("uncertain_contact_create_network", 502);
      }

      if (!createdContact.response.ok || !createdContact.isJson) {
        const code =
          createdContact.response.status >= 500
            ? "uncertain_contact_create_upstream"
            : "contact_create_rejected";
        return await failWithReviewState(
          code,
          createdContact.response.status >= 500 ? 502 : 409,
          createdContact.response.status,
        );
      }

      const contactData =
        createdContact.payload && typeof createdContact.payload === "object"
          ? (createdContact.payload as { data?: { name?: unknown } }).data
          : null;
      contactId = contactData && typeof contactData.name === "string" ? contactData.name : "";
      if (!contactId) {
        return await failWithReviewState(
          "uncertain_contact_create_missing_id",
          502,
          createdContact.response.status,
        );
      }
    }

    await completeCustomerSyncDurably({
      persistBookingCustomerId: () => upsertBookingCustomerId(customerId),
      publishMappingSynced: () =>
        updateMapping({
          source_name: booking.customer_name,
          erpnext_customer_id: customerId,
          erpnext_contact_id: contactId,
          processing_at: null,
          processing_token: null,
          synced_at: new Date().toISOString(),
          last_error: null,
          last_http_status: 200,
        }),
    });
    if (!(await releaseBookingLease())) {
      return json({ ok: false, error: "customer_booking_lease_release_failed" }, 500);
    }

    return json({
      ok: true,
      mode,
      booking_id: booking.id,
      writes_enabled: true,
      customer_state: "synced",
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "customer_sync_failed";
    if (mode === "commit" && syncToken) {
      return await failWithReviewState(code, 500);
    }
    return json({ ok: false, error: code }, 500);
  }
});
