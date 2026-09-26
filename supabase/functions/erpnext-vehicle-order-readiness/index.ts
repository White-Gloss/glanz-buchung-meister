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

const VEHICLE_DOCTYPE = "WHITE GLOSS Vehicle";
const ORDER_DOCTYPE = "WHITE GLOSS Order";

type FetchResult = {
  response: Response;
  payload: unknown;
  isJson: boolean;
  location: string | null;
};

type ResourceProbe = {
  ok: boolean;
  status: number | null;
  readable: boolean;
  exists: boolean | null;
};

type PermissionProbe = {
  ok: boolean;
  status: number | null;
  allowed?: boolean;
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

  const probeResource = async (doctype: string): Promise<ResourceProbe> => {
    try {
      const fields = encodeURIComponent(JSON.stringify(["name"]));
      const result = await getJson(
        `/api/resource/${encodeURIComponent(doctype)}?fields=${fields}&limit_page_length=1`,
      );

      if (result.response.status === 404) {
        return { ok: true, status: 404, readable: false, exists: false };
      }
      if (result.response.status === 403) {
        return { ok: true, status: 403, readable: false, exists: null };
      }
      if (!result.response.ok || !result.isJson || result.location) {
        return {
          ok: false,
          status: result.response.status,
          readable: false,
          exists: null,
        };
      }

      const data =
        result.payload && typeof result.payload === "object"
          ? (result.payload as { data?: unknown }).data
          : null;
      if (!Array.isArray(data)) {
        return {
          ok: false,
          status: result.response.status,
          readable: false,
          exists: null,
        };
      }

      return { ok: true, status: result.response.status, readable: true, exists: true };
    } catch {
      return { ok: false, status: null, readable: false, exists: null };
    }
  };

  const probePermission = async (
    doctype: string,
    permission: "create" | "write",
  ): Promise<PermissionProbe> => {
    try {
      const params = new URLSearchParams({
        doctype,
        docname: "",
        perm_type: permission,
      });
      const result = await getJson(`/api/method/frappe.client.has_permission?${params.toString()}`);
      if (
        !result.response.ok ||
        !result.isJson ||
        !result.payload ||
        typeof result.payload !== "object"
      ) {
        return { ok: false, status: result.response.status };
      }

      const message = (result.payload as { message?: unknown }).message;
      if (!message || typeof message !== "object" || !("has_permission" in message)) {
        return { ok: false, status: result.response.status };
      }

      const raw = (message as { has_permission?: unknown }).has_permission;
      return {
        ok: true,
        status: result.response.status,
        allowed: raw === true || raw === 1,
      };
    } catch {
      return { ok: false, status: null };
    }
  };

  try {
    const auth = await getJson("/api/method/frappe.auth.get_logged_user");
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
      return json(
        { ok: false, error: "erpnext_auth_failed", upstream_status: auth.response.status },
        502,
      );
    }

    const [vehicleResource, orderResource] = await Promise.all([
      probeResource(VEHICLE_DOCTYPE),
      probeResource(ORDER_DOCTYPE),
    ]);

    const [vehicleCreate, vehicleWrite, orderCreate, orderWrite] = await Promise.all([
      vehicleResource.exists === true
        ? probePermission(VEHICLE_DOCTYPE, "create")
        : Promise.resolve<PermissionProbe>({ ok: false, status: null }),
      vehicleResource.exists === true
        ? probePermission(VEHICLE_DOCTYPE, "write")
        : Promise.resolve<PermissionProbe>({ ok: false, status: null }),
      orderResource.exists === true
        ? probePermission(ORDER_DOCTYPE, "create")
        : Promise.resolve<PermissionProbe>({ ok: false, status: null }),
      orderResource.exists === true
        ? probePermission(ORDER_DOCTYPE, "write")
        : Promise.resolve<PermissionProbe>({ ok: false, status: null }),
    ]);

    const vehicleReady =
      vehicleResource.exists === true &&
      vehicleResource.readable &&
      vehicleCreate.ok &&
      vehicleCreate.allowed === true &&
      vehicleWrite.ok &&
      vehicleWrite.allowed === true;
    const orderReady =
      orderResource.exists === true &&
      orderResource.readable &&
      orderCreate.ok &&
      orderCreate.allowed === true &&
      orderWrite.ok &&
      orderWrite.allowed === true;

    return json({
      ok: true,
      mode: "preview",
      writes_performed: false,
      model_ready: vehicleReady && orderReady,
      standard_erpnext_vehicle_used: false,
      vehicle: {
        doctype: VEHICLE_DOCTYPE,
        resource: vehicleResource,
        permissions: {
          create: vehicleCreate,
          write: vehicleWrite,
        },
        ready: vehicleReady,
      },
      order: {
        doctype: ORDER_DOCTYPE,
        resource: orderResource,
        permissions: {
          create: orderCreate,
          write: orderWrite,
        },
        ready: orderReady,
      },
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return json({ ok: false, error: timeout ? "erpnext_timeout" : "erpnext_unreachable" }, 502);
  }
});
