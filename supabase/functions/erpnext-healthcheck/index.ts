import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const baseUrl = Deno.env.get("ERPNEXT_BASE_URL")?.replace(/\/$/, "");
  const apiKey = Deno.env.get("ERPNEXT_API_KEY");
  const apiSecret = Deno.env.get("ERPNEXT_API_SECRET");

  const missing = [
    ["ERPNEXT_BASE_URL", baseUrl],
    ["ERPNEXT_API_KEY", apiKey],
    ["ERPNEXT_API_SECRET", apiSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    return json({ ok: false, error: "missing_configuration", missing }, 500);
  }

  try {
    const response = await fetch(`${baseUrl}/api/method/frappe.auth.get_logged_user`, {
      method: "GET",
      headers: {
        Authorization: `token ${apiKey}:${apiSecret}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return json(
        {
          ok: false,
          error: "erpnext_auth_failed",
          upstream_status: response.status,
        },
        502,
      );
    }

    const payload = await response.json().catch(() => null);
    const authenticated = Boolean(
      payload && typeof payload === "object" && "message" in payload && payload.message,
    );

    return json(
      {
        ok: authenticated,
        upstream_status: response.status,
        authenticated,
      },
      authenticated ? 200 : 502,
    );
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return json(
      {
        ok: false,
        error: timeout ? "erpnext_timeout" : "erpnext_unreachable",
      },
      502,
    );
  }
});
