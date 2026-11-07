import { createFileRoute } from "@tanstack/react-router";

async function respond(request: Request, id: string) {
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const headers = {
    "Cache-Control": "private, no-store",
    "CDN-Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": preview ? "noindex, nofollow, noarchive" : "noarchive",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  const { studioMediaEnabled } = await import("@/lib/studio-media.server");
  if (!studioMediaEnabled()) return new Response(null, { status: 404, headers });
  if (preview) {
    try {
      const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
      const { requireUserId } = await import("@/lib/auth/verify.server");
      const { requireOperator } = await import("@/lib/operator");
      assertSameSiteRequest();
      await requireOperator(await requireUserId());
    } catch {
      return new Response(null, { status: 401, headers });
    }
  }
  try {
    const { assertStudioMediaStorage, readStudioMedia } = await import("@/lib/studio-media.server");
    const directory = assertStudioMediaStorage();
    const { getSql } = await import("@/lib/db");
    const bytes = await readStudioMedia(await getSql(), id, directory, preview);
    if (!bytes) return new Response(null, { status: 404, headers });
    return new Response(request.method === "HEAD" ? null : new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}

export const Route = createFileRoute("/api/studio-media/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => respond(request, params.id),
      HEAD: ({ request, params }) => respond(request, params.id),
    },
  },
});
