import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

type ProbeResult = {
  ok: boolean;
  status: number | null;
  count?: number;
  expected_found?: boolean;
  names?: string[];
};

type FetchResult = {
  response: Response;
  payload: unknown;
  contentType: string;
  isJson: boolean;
  location: string | null;
};

const safeUrl = (value: string | undefined) => {
  if (!value) return "missing";
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid_url";
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = Deno.env.get("ERPNEXT_BASE_URL")?.trim().replace(/\/$/, "");
  const apiKey = Deno.env.get("ERPNEXT_API_KEY")?.trim();
  const apiSecret = Deno.env.get("ERPNEXT_API_SECRET")?.trim();

  const missing = [
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["ERPNEXT_BASE_URL", baseUrl],
    ["ERPNEXT_API_KEY", apiKey],
    ["ERPNEXT_API_SECRET", apiSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    return json({ ok: false, error: "missing_configuration", missing }, 500);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "authentication_required" }, 401);

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const recordState = async (
    stage: string,
    ok: boolean,
    options: {
      upstreamStatus?: number | null;
      permissionsReady?: boolean | null;
      detail?: string | null;
    } = {},
  ) => {
    try {
      await supabase.from("erpnext_healthcheck_state").upsert(
        {
          id: true,
          checked_at: new Date().toISOString(),
          stage,
          ok,
          upstream_status: options.upstreamStatus ?? null,
          permissions_ready: options.permissionsReady ?? null,
          detail: options.detail ?? null,
        },
        { onConflict: "id" },
      );
    } catch {
      // Diagnostics must never change the healthcheck result.
    }
  };

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

  const headers = {
    Authorization: `token ${apiKey}:${apiSecret}`,
    Accept: "application/json",
  };

  const getJson = async (path: string): Promise<FetchResult> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const locationRaw = response.headers.get("location");
    let location: string | null = null;
    if (locationRaw) {
      try {
        location = safeUrl(new URL(locationRaw, baseUrl).toString());
      } catch {
        location = "invalid_location";
      }
    }

    const text = await response.text();
    let payload: unknown = null;
    let isJson = false;
    try {
      payload = text ? JSON.parse(text) : null;
      isJson = true;
    } catch {
      payload = null;
    }

    return { response, payload, contentType, isJson, location };
  };

  const probeList = async (doctype: string, expected?: string): Promise<ProbeResult> => {
    try {
      const fields = encodeURIComponent(JSON.stringify(["name"]));
      const { response, payload, isJson } = await getJson(
        `/api/resource/${encodeURIComponent(doctype)}?fields=${fields}&limit_page_length=100`,
      );
      const rows =
        isJson &&
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { data?: unknown }).data)
          ? (payload as { data: Array<{ name?: unknown }> }).data
          : null;

      if (!response.ok || !rows) return { ok: false, status: response.status };

      const names = rows
        .map((row) => (typeof row?.name === "string" ? row.name : ""))
        .filter(Boolean)
        .slice(0, 10);

      return {
        ok: true,
        status: response.status,
        count: rows.length,
        names,
        ...(expected ? { expected_found: names.includes(expected) } : {}),
      };
    } catch {
      return { ok: false, status: null };
    }
  };

  try {
    const baseHint = safeUrl(baseUrl);
    await recordState("erpnext_connecting", true, { detail: `base=${baseHint}` });

    const auth = await getJson("/api/method/frappe.auth.get_logged_user");
    if (!auth.response.ok) {
      const detail =
        `base=${baseHint};content_type=${auth.contentType || "none"};` +
        `json=${auth.isJson};location=${auth.location ?? "none"}`;
      await recordState("erpnext_auth_failed", false, {
        upstreamStatus: auth.response.status,
        detail,
      });
      return json(
        { ok: false, error: "erpnext_auth_failed", upstream_status: auth.response.status },
        502,
      );
    }

    const payload = auth.payload as { message?: unknown } | null;
    const authenticated = Boolean(
      payload &&
        typeof payload === "object" &&
        typeof payload.message === "string" &&
        payload.message.length > 0 &&
        payload.message !== "Guest",
    );

    if (!authenticated) {
      const keys =
        payload && typeof payload === "object"
          ? Object.keys(payload).slice(0, 8).join(",")
          : "none";
      const messageType =
        payload && typeof payload === "object" && "message" in payload
          ? typeof payload.message
          : "missing";
      const detail =
        `base=${baseHint};content_type=${auth.contentType || "none"};json=${auth.isJson};` +
        `keys=${keys};message_type=${messageType};location=${auth.location ?? "none"}`;
      await recordState("erpnext_auth_unconfirmed", false, {
        upstreamStatus: auth.response.status,
        detail,
      });
      return json(
        { ok: false, error: "erpnext_auth_unconfirmed", upstream_status: auth.response.status },
        502,
      );
    }

    const [company, customerGroup, territory] = await Promise.all([
      probeList("Company", "White-Gloss"),
      probeList("Customer Group", "Individual"),
      probeList("Territory", "All Territories"),
    ]);

    const permissionsReady =
      company.ok &&
      company.expected_found === true &&
      customerGroup.ok &&
      customerGroup.expected_found === true &&
      territory.ok &&
      territory.expected_found === true;

    const companyNames = company.names?.join("|") || "none";
    await recordState("complete", permissionsReady, {
      upstreamStatus: auth.response.status,
      permissionsReady,
      detail: permissionsReady
        ? "readiness_checks_passed"
        : `company=${company.status};company_names=${companyNames};` +
          `customer_group=${customerGroup.status};territory=${territory.status}`,
    });

    return json({
      ok: true,
      authenticated: true,
      upstream_status: auth.response.status,
      permissions_ready: permissionsReady,
      checks: { company, customer_group: customerGroup, territory },
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    const stage = timeout ? "erpnext_timeout" : "erpnext_unreachable";
    await recordState(stage, false, {
      detail: timeout ? "upstream_timeout" : "upstream_network_error",
    });
    return json({ ok: false, error: stage }, 502);
  }
});
