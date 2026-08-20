import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

type ProbeResult = {
  ok: boolean;
  status: number | null;
  count?: number;
  expected_found?: boolean;
};

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

  const headers = {
    Authorization: `token ${apiKey}:${apiSecret}`,
    Accept: "application/json",
  };

  const getJson = async (path: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  };

  const probeList = async (doctype: string, expected?: string): Promise<ProbeResult> => {
    try {
      const fields = encodeURIComponent(JSON.stringify(["name"]));
      const { response, payload } = await getJson(
        `/api/resource/${encodeURIComponent(doctype)}?fields=${fields}&limit_page_length=100`,
      );
      if (!response.ok) return { ok: false, status: response.status };
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      return {
        ok: true,
        status: response.status,
        count: rows.length,
        ...(expected
          ? {
              expected_found: rows.some(
                (row: unknown) => (row as { name?: unknown })?.name === expected,
              ),
            }
          : {}),
      };
    } catch {
      return { ok: false, status: null };
    }
  };

  try {
    const { response: authResponse, payload: authPayload } = await getJson(
      "/api/method/frappe.auth.get_logged_user",
    );

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

    const authenticated = Boolean(
      authPayload &&
        typeof authPayload === "object" &&
        "message" in authPayload &&
        authPayload.message,
    );

    if (!authenticated) {
      return json({ ok: false, error: "erpnext_auth_unconfirmed" }, 502);
    }

    const [company, customerGroup, territory] = await Promise.all([
      probeList("Company", "WHITE GLOSS"),
      probeList("Customer Group", "Individual"),
      probeList("Territory", "All Territories"),
    ]);

    const permissionsReady = company.ok && customerGroup.ok && territory.ok;

    return json({
      ok: true,
      authenticated: true,
      upstream_status: authResponse.status,
      permissions_ready: permissionsReady,
      checks: {
        company,
        customer_group: customerGroup,
        territory,
      },
    });
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
