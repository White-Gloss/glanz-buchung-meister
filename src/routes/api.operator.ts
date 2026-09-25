import { createFileRoute } from "@tanstack/react-router";

const retired = () => new Response(null, { status: 410 });
export const Route = createFileRoute("/api/operator")({
  server: { handlers: { GET: retired, POST: retired } },
});
