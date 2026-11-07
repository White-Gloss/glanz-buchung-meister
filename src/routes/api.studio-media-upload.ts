import { createFileRoute } from "@tanstack/react-router";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export const Route = createFileRoute("/api/studio-media-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { studioMediaEnabled } = await import("@/lib/studio-media.server");
        if (!studioMediaEnabled())
          return Response.json(
            { error: "Website Studio ist noch nicht freigeschaltet." },
            { status: 404, headers },
          );
        let userId: string;
        try {
          const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
          const { requireUserId } = await import("@/lib/auth/verify.server");
          const { requireOperator } = await import("@/lib/operator");
          assertSameSiteRequest();
          userId = await requireUserId();
          await requireOperator(userId);
        } catch {
          return Response.json(
            { error: "Bitte mit einem Betriebskonto anmelden." },
            { status: 401, headers },
          );
        }
        const { readStudioUpload, StudioUploadError } =
          await import("@/lib/studio-media-upload.server");
        try {
          const { assertStudioMediaStorage, storeStudioImage } =
            await import("@/lib/studio-media.server");
          const directory = assertStudioMediaStorage();
          const file = await readStudioUpload(request);
          const { getSql } = await import("@/lib/db");
          const media = await storeStudioImage(await getSql(), file, userId, directory);
          return Response.json({ media }, { status: 201, headers });
        } catch (error) {
          if (error instanceof StudioUploadError)
            return Response.json({ error: error.message }, { status: error.status, headers });
          const message = error instanceof Error ? error.message : "";
          if (
            /^(Das Bild konnte nicht verarbeitet|Das Format passt|Es werden bereits Bilder verarbeitet|Bitte ein Bild|Ein Bild darf|Die Bilddatei)/.test(
              message,
            )
          ) {
            return Response.json({ error: message }, { status: 400, headers });
          }
          return Response.json(
            {
              error:
                "Der Bildspeicher ist noch nicht verfügbar. Bitte die Einrichtung prüfen und erneut versuchen.",
            },
            { status: 503, headers },
          );
        }
      },
    },
  },
});
