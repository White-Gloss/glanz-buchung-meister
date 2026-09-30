import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { listHubInquiries } from "@/lib/hub-inquiries";

const retired = () => new Response(null, { status: 410 });

function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/.exec(header);
  return match?.[1] ?? "";
}

function sameToken(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

async function post({ request }: { request: Request }) {
  const secret = (process.env.HUB_SYNC_TOKEN ?? "").trim();
  if (secret.length < 32) return retired();
  if (!sameToken(bearer(request), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : "";
  if (action !== "list") return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    const inquiries = await listHubInquiries(await getSql());
    return Response.json({ inquiries });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export const Route = createFileRoute("/api/hub")({
  server: { handlers: { GET: retired, POST: post } },
});
