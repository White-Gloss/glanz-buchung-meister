import { createFileRoute } from "@tanstack/react-router";
const retired = () => Response.json({ error: "retired_integration" }, { status: 410 });
export const Route = createFileRoute("/api/bitrix-workshop")({
  server: { handlers: { GET: retired, POST: retired } },
});
