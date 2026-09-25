import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Legacy CRM integration retired. This endpoint never reads or writes customer data.
Deno.serve(() =>
  Response.json({ error: "retired_crm", message: "Bitte Bitrix24 verwenden." }, { status: 410 }),
);
