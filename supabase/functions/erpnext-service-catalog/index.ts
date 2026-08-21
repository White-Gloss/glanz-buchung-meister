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

const CONFIRMATION = "CREATE_WHITE_GLOSS_SERVICE_CATALOG_V1";
const ITEM_GROUP = "Services";
const STOCK_UOM = "Nos";

type RequestBody = {
  mode?: unknown;
  confirmation?: unknown;
};

type CatalogEntry = {
  code: string;
  label: string;
  kind: "package" | "addon" | "pickup";
};

type ItemState = CatalogEntry & {
  present: boolean;
  erpnext_name?: string;
  item_name?: string;
  item_group?: string;
  stock_uom?: string;
  disabled?: boolean;
  is_sales_item?: boolean;
  is_stock_item?: boolean;
};

type PermissionProbe = {
  ok: boolean;
  status: number | null;
  allowed?: boolean;
};

type ErpResult = {
  response: Response;
  payload: unknown;
  isJson: boolean;
  location: string | null;
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

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    body = {};
  }

  const mode = body.mode === "commit" ? "commit" : "preview";
  if (mode === "commit" && body.confirmation !== CONFIRMATION) {
    return json({ ok: false, error: "catalog_write_confirmation_required" }, 409);
  }

  const headers = {
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
        ...headers,
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

  const getJson = (path: string) => erpRequest("GET", path);

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

  const exactNameExists = async (doctype: string, name: string) => {
    const fields = encodeURIComponent(JSON.stringify(["name"]));
    const filters = encodeURIComponent(JSON.stringify([["name", "=", name]]));
    const result = await getJson(
      `/api/resource/${encodeURIComponent(doctype)}?fields=${fields}&filters=${filters}&limit_page_length=2`,
    );
    if (
      !result.response.ok ||
      !result.isJson ||
      !result.payload ||
      typeof result.payload !== "object"
    ) {
      throw new Error(`prerequisite_lookup_failed:${doctype}:${result.response.status}`);
    }
    const rows = Array.isArray((result.payload as { data?: unknown }).data)
      ? ((result.payload as { data: Array<{ name?: unknown }> }).data ?? [])
      : null;
    if (!rows) throw new Error(`prerequisite_lookup_invalid_response:${doctype}`);
    return rows.length === 1 && rows[0]?.name === name;
  };

  const lookupItem = async (entry: CatalogEntry): Promise<ItemState> => {
    const fields = encodeURIComponent(
      JSON.stringify([
        "name",
        "item_code",
        "item_name",
        "item_group",
        "stock_uom",
        "disabled",
        "is_sales_item",
        "is_stock_item",
      ]),
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
      item_group: typeof row.item_group === "string" ? row.item_group : undefined,
      stock_uom: typeof row.stock_uom === "string" ? row.stock_uom : undefined,
      disabled: row.disabled === 1 || row.disabled === true,
      is_sales_item: row.is_sales_item === 1 || row.is_sales_item === true,
      is_stock_item: row.is_stock_item === 1 || row.is_stock_item === true,
    };
  };

  const isValidCatalogItem = (item: ItemState) =>
    item.present &&
    item.disabled !== true &&
    item.is_sales_item === true &&
    item.is_stock_item === false &&
    item.item_group === ITEM_GROUP &&
    item.stock_uom === STOCK_UOM;

  const buildSnapshot = async () => {
    const [itemCreate, itemWrite, itemGroupReady, uomReady, ...itemResults] = await Promise.all([
      probePermission("create"),
      probePermission("write"),
      exactNameExists("Item Group", ITEM_GROUP),
      exactNameExists("UOM", STOCK_UOM),
      ...catalog.map((entry) => lookupItem(entry)),
    ]);
    const items = itemResults as ItemState[];
    const missing = items.filter((item) => !item.present).map((item) => item.code);
    const invalid = items.filter((item) => item.present && !isValidCatalogItem(item)).map((item) => item.code);
    return {
      itemCreate,
      itemWrite,
      itemGroupReady,
      uomReady,
      items,
      missing,
      invalid,
      catalogReady: missing.length === 0 && invalid.length === 0,
    };
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

    const snapshot = await buildSnapshot();
    const prerequisitesReady = snapshot.itemGroupReady && snapshot.uomReady;
    const createPermissionReady =
      snapshot.itemCreate.ok && snapshot.itemCreate.allowed === true;

    if (mode === "preview") {
      return json({
        ok: true,
        mode,
        writes_performed: false,
        catalog_ready: snapshot.catalogReady,
        write_ready:
          prerequisitesReady &&
          createPermissionReady &&
          snapshot.invalid.length === 0 &&
          snapshot.missing.length > 0,
        existing_count: snapshot.items.length - snapshot.missing.length,
        expected_count: snapshot.items.length,
        missing_codes: snapshot.missing,
        invalid_codes: snapshot.invalid,
        prerequisites: {
          item_group: ITEM_GROUP,
          item_group_ready: snapshot.itemGroupReady,
          stock_uom: STOCK_UOM,
          stock_uom_ready: snapshot.uomReady,
        },
        item_permissions: {
          create: snapshot.itemCreate,
          write: snapshot.itemWrite,
        },
        items: snapshot.items,
      });
    }

    if (!prerequisitesReady) {
      return json({ ok: false, error: "catalog_prerequisites_missing" }, 409);
    }
    if (!createPermissionReady) {
      return json({ ok: false, error: "item_create_permission_missing" }, 403);
    }
    if (snapshot.invalid.length > 0) {
      return json(
        { ok: false, error: "existing_catalog_items_require_review", invalid_codes: snapshot.invalid },
        409,
      );
    }

    const createdCodes: string[] = [];
    const reusedCodes: string[] = [];

    for (const entry of catalog) {
      const before = await lookupItem(entry);
      if (before.present) {
        if (!isValidCatalogItem(before)) {
          return json(
            { ok: false, error: "catalog_item_changed_during_write", code: entry.code },
            409,
          );
        }
        reusedCodes.push(entry.code);
        continue;
      }

      let created: ErpResult;
      try {
        created = await erpRequest("POST", "/api/resource/Item", {
          item_code: entry.code,
          item_name: entry.label,
          item_group: ITEM_GROUP,
          stock_uom: STOCK_UOM,
          is_stock_item: 0,
          is_sales_item: 1,
          is_purchase_item: 0,
        });
      } catch {
        return json(
          {
            ok: false,
            error: "uncertain_item_create_network",
            code: entry.code,
            created_codes: createdCodes,
            reused_codes: reusedCodes,
          },
          502,
        );
      }

      if (!created.response.ok || !created.isJson) {
        const uncertain = created.response.status >= 500;
        return json(
          {
            ok: false,
            error: uncertain ? "uncertain_item_create_upstream" : "item_create_rejected",
            code: entry.code,
            upstream_status: created.response.status,
            created_codes: createdCodes,
            reused_codes: reusedCodes,
          },
          uncertain ? 502 : 409,
        );
      }

      const verified = await lookupItem(entry);
      if (!isValidCatalogItem(verified)) {
        return json(
          {
            ok: false,
            error: "created_item_verification_failed",
            code: entry.code,
            created_codes: createdCodes,
            reused_codes: reusedCodes,
          },
          502,
        );
      }
      createdCodes.push(entry.code);
    }

    const finalSnapshot = await buildSnapshot();
    if (!finalSnapshot.catalogReady) {
      return json(
        {
          ok: false,
          error: "catalog_post_write_verification_failed",
          missing_codes: finalSnapshot.missing,
          invalid_codes: finalSnapshot.invalid,
          created_codes: createdCodes,
          reused_codes: reusedCodes,
        },
        502,
      );
    }

    return json({
      ok: true,
      mode,
      writes_performed: createdCodes.length > 0,
      catalog_ready: true,
      existing_count: finalSnapshot.items.length,
      expected_count: finalSnapshot.items.length,
      missing_codes: [],
      invalid_codes: [],
      created_codes: createdCodes,
      reused_codes: reusedCodes,
      prerequisites: {
        item_group: ITEM_GROUP,
        item_group_ready: finalSnapshot.itemGroupReady,
        stock_uom: STOCK_UOM,
        stock_uom_ready: finalSnapshot.uomReady,
      },
      item_permissions: {
        create: finalSnapshot.itemCreate,
        write: finalSnapshot.itemWrite,
      },
      items: finalSnapshot.items,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "service_catalog_check_failed";
    return json({ ok: false, error: code }, 502);
  }
});
