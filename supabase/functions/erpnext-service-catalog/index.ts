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

type CatalogEntry = {
  code: string;
  label: string;
  kind: "package" | "addon" | "pickup";
};

type ItemState = CatalogEntry & {
  present: boolean;
  erpnext_name?: string;
  item_name?: string;
  disabled?: boolean;
  is_sales_item?: boolean;
};

type PermissionProbe = {
  ok: boolean;
  status: number | null;
  allowed?: boolean;
};

const catalog: CatalogEntry[] = [
  { code: "WG-PKG-BASIS", label: "Basis Pflege", kind: "package" },
  { code: "WG-PKG-PREMIUM", label: "Premium Glanz", kind: "package" },
  { code: "WG-PKG-KERAMIK", label: "High-End Keramik", kind: "package" },
  { code: "WG-ADD-FELGEN", label: "Felgen-Spezial", kind: "addon" },
  { code: "WG-ADD-LEDER", label: "Lederpflege Deluxe", kind: "addon" },
  { code: "WG-ADD-MOTOR", label: "Motorwäsche", kind: "addon" },
  { code: "WG-ADD-OZON", label: "Innenraum-Ozon", kind: "addon" },
  { code: "WG-ADD-SCHEINWERFER", label: "Scheinwerfer-Aufbereitung", kind: "addon" },
  { code: "WG-ADD-HOLBRING", label: "Hol- & Bringservice", kind: "addon" },
  { code: "WG-PICKUP-10KM", label: "Abholung bis 10 km", kind: "pickup" },
  { code: "WG-PICKUP-20KM", label: "Abholung bis 20 km", kind: "pickup" },
  { code: "WG-PICKUP-50KM", label: "Abholung bis 50 km", kind: "pickup" },
];

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

  const getJson = async (path: string) => {
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

  const probePermission = async (permission: "create" | "write"): Promise<PermissionProbe> => {
    try {
      const params = new URLSearchParams({
        doctype: "Item",
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

    const [itemCreate, itemWrite, ...itemResults] = await Promise.all([
      probePermission("create"),
      probePermission("write"),
      ...catalog.map(async (entry): Promise<ItemState> => {
        const fields = encodeURIComponent(
          JSON.stringify(["name", "item_code", "item_name", "disabled", "is_sales_item"]),
        );
        const filters = encodeURIComponent(JSON.stringify([["item_code", "=", entry.code]]));
        const result = await getJson(
          `/api/resource/Item?fields=${fields}&filters=${filters}&limit_page_length=2`,
        );
        if (
          !result.response.ok ||
          !result.isJson ||
          !result.payload ||
          typeof result.payload !== "object"
        ) {
          throw new Error(`item_lookup_failed:${entry.code}:${result.response.status}`);
        }
        const rows = Array.isArray((result.payload as { data?: unknown }).data)
          ? ((result.payload as { data: Array<Record<string, unknown>> }).data ?? [])
          : null;
        if (!rows) throw new Error(`item_lookup_invalid_response:${entry.code}`);
        if (rows.length > 1) throw new Error(`item_lookup_not_unique:${entry.code}`);
        const row = rows[0];
        if (!row) return { ...entry, present: false };
        return {
          ...entry,
          present: true,
          erpnext_name: typeof row.name === "string" ? row.name : undefined,
          item_name: typeof row.item_name === "string" ? row.item_name : undefined,
          disabled: row.disabled === 1 || row.disabled === true,
          is_sales_item: row.is_sales_item === 1 || row.is_sales_item === true,
        };
      }),
    ]);

    const items = itemResults as ItemState[];
    const missing = items.filter((item) => !item.present).map((item) => item.code);
    const invalid = items
      .filter((item) => item.present && (item.disabled === true || item.is_sales_item === false))
      .map((item) => item.code);

    return json({
      ok: true,
      mode: "preview",
      writes_performed: false,
      catalog_ready: missing.length === 0 && invalid.length === 0,
      existing_count: items.length - missing.length,
      expected_count: items.length,
      missing_codes: missing,
      invalid_codes: invalid,
      item_permissions: {
        create: itemCreate,
        write: itemWrite,
      },
      items,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "service_catalog_check_failed";
    return json({ ok: false, error: code }, 502);
  }
});
