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

const allowedHost = "white-gloss-detailing-1.odoo.com";

function normalizeBaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (
      url.protocol !== "https:" ||
      url.hostname !== allowedHost ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = normalizeBaseUrl(Deno.env.get("ODOO_BASE_URL"));
  const database = Deno.env.get("ODOO_DATABASE")?.trim();
  const apiKey = Deno.env.get("ODOO_API_KEY")?.trim();
  const missing = [
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["ODOO_BASE_URL", baseUrl],
    ["ODOO_DATABASE", database],
    ["ODOO_API_KEY", apiKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) return json({ ok: false, error: "missing_configuration", missing }, 500);

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "authentication_required" }, 401);

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
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

  const record = async (stage: string, ok: boolean, upstreamStatus: number | null) => {
    try {
      await supabase.from("odoo_healthcheck_state").upsert(
        {
          id: true,
          checked_at: new Date().toISOString(),
          stage,
          ok,
          upstream_status: upstreamStatus,
          detail: `host=${allowedHost};database=${database}`,
        },
        { onConflict: "id" },
      );
    } catch {
      // Diagnostics must never alter the probe response.
    }
  };

  try {
    const response = await fetch(`${baseUrl}/json/2/res.users/context_get`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Odoo-Database": database!,
      },
      body: "{}",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : null;
    const uid =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { uid?: unknown }).uid === "number"
        ? (payload as { uid: number }).uid
        : null;
    const ok = response.ok && uid !== null;
    await record(ok ? "odoo_ready" : "odoo_probe_failed", ok, response.status);
    return json(
      ok
        ? { ok: true, upstream_status: response.status, uid }
        : {
            ok: false,
            error: response.status === 401 ? "odoo_auth_failed" : "odoo_invalid_response",
            upstream_status: response.status,
          },
      ok ? 200 : 502,
    );
  } catch {
    await record("odoo_unreachable", false, null);
    return json({ ok: false, error: "odoo_unreachable" }, 502);
  }
});
