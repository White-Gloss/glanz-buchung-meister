import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import type { StudioMedia } from "./studio-media.model";

async function privateResponse() {
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  setResponseHeader("X-Robots-Tag", "noindex, nofollow");
}

export const listCmsMedia = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    await privateResponse();
    const { assertStudioMediaEnabled, listStudioMedia } = await import("./studio-media.server");
    assertStudioMediaEnabled();
    const { getSql } = await import("./db");
    return listStudioMedia(await getSql());
  });

/** A dedicated route bounds the stream before multipart parsing. Other operations remain server functions. */
export async function uploadCmsImage({ data }: { data: FormData }): Promise<StudioMedia> {
  const { getBearerToken } = await import("./auth/client");
  const bearer = getBearerToken();
  const response = await fetch("/api/studio-media-upload", {
    method: "POST",
    body: data,
    credentials: "same-origin",
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
  });
  const result = (await response.json()) as { media?: StudioMedia; error?: string };
  if (!response.ok || !result.media)
    throw new Error(
      result.error || "Das Bild konnte nicht übertragen werden. Bitte erneut versuchen.",
    );
  return result.media;
}

export const updateCmsMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator(
    (input: {
      id: string;
      expectedVersion: number;
      alt: string;
      caption: string;
      approved: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    await privateResponse();
    const { assertStudioMediaStorage, changeStudioMedia } = await import("./studio-media.server");
    assertStudioMediaStorage();
    const { getSql } = await import("./db");
    return changeStudioMedia(await getSql(), data);
  });

export const archiveCmsMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: { id: string; expectedVersion: number }) => {
    if (!input || typeof input.id !== "string" || !Number.isInteger(input.expectedVersion))
      throw new Error("Ungültige Bildangaben.");
    return input;
  })
  .handler(async ({ data }) => {
    await privateResponse();
    const { assertStudioMediaStorage, archiveStudioMedia } = await import("./studio-media.server");
    assertStudioMediaStorage();
    const { getSql } = await import("./db");
    return archiveStudioMedia(await getSql(), data.id, data.expectedVersion);
  });
