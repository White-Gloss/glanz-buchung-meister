import { randomUUID } from "node:crypto";
import { isIsolatedGithubCi } from "../../scripts/hosting-policy.mjs";
import { cmsEnabled } from "./cms.availability.ts";
import { customerPhotos } from "../data/customer-photos.ts";
import type { Sql } from "./db.ts";
import {
  isStudioMediaId,
  STUDIO_IMAGE_MAX_BYTES,
  type StudioAsset,
  type StudioMedia,
  type StudioMediaContent,
} from "./studio-media.model.ts";
import { createStudioMediaStore, studioMediaDirectory } from "./studio-media-storage.server.ts";

const SHOP = "white-gloss";
export function studioMediaEnabled(): boolean {
  return cmsEnabled({
    enabled: process.env.WEBSITE_STUDIO_ENABLED,
    isolatedCi: isIsolatedGithubCi(),
  });
}
export function assertStudioMediaEnabled(): void {
  if (!studioMediaEnabled()) throw new Error("Website Studio ist noch nicht freigeschaltet.");
}
type MediaRow = {
  id: string;
  original_name: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  bytes: number;
  version: number;
  approved: boolean;
  archived_at: string | Date | null;
};
const columns = "id,original_name,alt,caption,width,height,bytes,version,approved,archived_at";

export const studioStaticCatalog: StudioAsset[] = customerPhotos.map((photo) => ({
  id: `static:${photo.id}`,
  src: photo.src,
  previewSrc: photo.src,
  width: photo.width,
  height: photo.height,
  alt: photo.alt,
  caption: photo.title,
}));

function media(row: MediaRow): StudioMedia {
  const publicUrl = `/api/studio-media/${row.id}`;
  return {
    id: row.id,
    originalName: row.original_name,
    alt: row.alt,
    caption: row.caption,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    version: row.version,
    approved: row.approved,
    archivedAt: row.archived_at instanceof Date ? row.archived_at.toISOString() : row.archived_at,
    previewUrl: `${publicUrl}?preview=1`,
    publicUrl,
  };
}

function contentAssetIds(content: StudioMediaContent): string[] {
  return [
    ...new Set(
      [content.heroAssetId, ...content.images.map((image) => image.assetId)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
}

/** Called within the publication transaction. Media locks serialize approval/revocation against publishing. */
export async function validateCmsAssetsForPublication(
  sql: Sql,
  content: StudioMediaContent,
): Promise<void> {
  const catalog = new Set(studioStaticCatalog.map((asset) => asset.id));
  for (const id of contentAssetIds(content).sort()) {
    if (catalog.has(id)) continue;
    if (!isStudioMediaId(id))
      throw new Error("Dieses Bild ist nicht in der freigegebenen Mediathek vorhanden.");
    const [row] = await sql<{ approved: boolean; archived_at: string | null; alt: string }>`
      select approved,archived_at,alt from cms_media where shop_id=${SHOP} and id=${id} for share`;
    if (!row || !row.approved || row.archived_at || !row.alt.trim()) {
      throw new Error(
        "Mindestens ein Bild ist nicht zur Veröffentlichung freigegeben oder wurde entfernt.",
      );
    }
  }
}

export async function listStudioMedia(sql: Sql) {
  const rows = await sql.query<MediaRow>(
    `select ${columns} from cms_media where shop_id=$1 and archived_at is null order by created_at desc,id limit 500`,
    [SHOP],
  );
  return { uploads: rows.map(media), catalog: studioStaticCatalog };
}

/** Only active published revisions grant public access. Draft and historical references never do. */
async function publicMediaRows(sql: Sql, ids: string[]): Promise<MediaRow[]> {
  if (!ids.length) return [];
  return sql.query<MediaRow>(
    `select ${columns
      .split(",")
      .map((column) => `m.${column}`)
      .join(",")} from cms_media m
    where m.shop_id=$1 and m.id=any($2::uuid[]) and m.approved=true and m.archived_at is null
    and exists (select 1 from cms_items ci join cms_revisions r on r.id=ci.published_revision_id and r.shop_id=ci.shop_id and r.item_id=ci.id
      where ci.shop_id=$1 and ci.published=true and ci.archived_at is null
      and (r.content->>'heroAssetId'=m.id::text or exists (select 1 from jsonb_array_elements(coalesce(r.content->'images','[]'::jsonb)) image where image->>'assetId'=m.id::text)))`,
    [SHOP, ids],
  );
}

/** preview=true is internal and must only be reached after operator authentication. */
export async function resolveCmsAssets(
  sql: Sql,
  content: StudioMediaContent,
  options: { preview?: boolean } = {},
): Promise<StudioAsset[]> {
  const assets: StudioAsset[] = [];
  const ids = contentAssetIds(content);
  const uploadIds = ids.filter(isStudioMediaId);
  const uploads = !uploadIds.length
    ? []
    : options.preview
      ? await sql.query<MediaRow>(
          `select ${columns} from cms_media where shop_id=$1 and id=any($2::uuid[]) and archived_at is null`,
          [SHOP, uploadIds],
        )
      : await publicMediaRows(sql, uploadIds);
  const byId = new Map(uploads.map((row) => [row.id, row]));
  for (const id of ids) {
    const existing = studioStaticCatalog.find((asset) => asset.id === id);
    if (existing) {
      assets.push(existing);
      continue;
    }
    if (!isStudioMediaId(id)) continue;
    const row = byId.get(id);
    if (row) {
      const value = media(row);
      assets.push({
        id,
        src: value.publicUrl,
        previewSrc: value.previewUrl,
        width: row.width,
        height: row.height,
        alt: row.alt,
        caption: row.caption,
      });
    }
  }
  return assets;
}

export function assertStudioMediaStorage(): string {
  assertStudioMediaEnabled();
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.DATABASE_URL?.trim() &&
    !isIsolatedGithubCi()
  ) {
    throw new Error("Der Bildspeicher benötigt eine dauerhaft angebundene Datenbank.");
  }
  return studioMediaDirectory(process.env.CMS_MEDIA_DIR);
}

let activeOptimizations = 0;
export async function storeStudioImage(sql: Sql, file: File, userId: string, directory: string) {
  if (!file.size || file.size > STUDIO_IMAGE_MAX_BYTES)
    throw new Error("Bitte ein Bild zwischen 1 Byte und 12 MiB auswählen.");
  if (activeOptimizations >= 2)
    throw new Error(
      "Es werden bereits Bilder verarbeitet. Bitte kurz warten und erneut versuchen.",
    );
  activeOptimizations++;
  try {
    const { optimizeStudioImage } = await import("./studio-media-image.server.ts");
    const optimized = await optimizeStudioImage(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    const id = randomUUID();
    const storage = createStudioMediaStore(directory);
    await storage.put(id, optimized.data);
    try {
      const safeName = file.name.replace(/[/\\\u0000-\u001f\u007f]/g, "_").slice(0, 160) || "Bild";
      const [row] = await sql.query<MediaRow>(
        `insert into cms_media(id,shop_id,original_name,width,height,bytes,sha256,created_by)
        values($1,$2,$3,$4,$5,$6,$7,$8) returning ${columns}`,
        [
          id,
          SHOP,
          safeName,
          optimized.width,
          optimized.height,
          optimized.data.byteLength,
          optimized.sha256,
          userId,
        ],
      );
      if (!row) throw new Error("Bild konnte nicht gespeichert werden.");
      return media(row);
    } catch (error) {
      // A lost acknowledgement does not prove that INSERT failed. Recover by the
      // exact random ID before removing anything. Unknown outcomes stay private.
      let persisted: MediaRow[];
      try {
        persisted = await sql.query<MediaRow>(`select ${columns} from cms_media where shop_id=$1 and id=$2`, [SHOP, id]);
      } catch { throw error; }
      if (persisted[0]) return media(persisted[0]);
      await storage.remove(id).catch(() => undefined);
      throw error;
    }
  } finally {
    activeOptimizations--;
  }
}

export function parseStudioMediaChange(input: unknown) {
  const value = input as Record<string, unknown> | null;
  if (
    !value ||
    typeof value.id !== "string" ||
    !isStudioMediaId(value.id) ||
    !Number.isInteger(value.expectedVersion) ||
    Number(value.expectedVersion) < 1 ||
    typeof value.alt !== "string" ||
    value.alt.length > 300 ||
    typeof value.caption !== "string" ||
    value.caption.length > 500 ||
    typeof value.approved !== "boolean"
  )
    throw new Error("Ungültige Bildangaben.");
  if (value.approved && !value.alt.trim())
    throw new Error("Vor der Freigabe bitte einen beschreibenden Alt-Text ergänzen.");
  return {
    id: value.id,
    expectedVersion: Number(value.expectedVersion),
    alt: value.alt.trim(),
    caption: value.caption.trim(),
    approved: value.approved,
  };
}

export async function changeStudioMedia(
  sql: Sql,
  input: ReturnType<typeof parseStudioMediaChange>,
): Promise<StudioMedia> {
  const data = parseStudioMediaChange(input);
  return sql.transaction(async (tx) => {
    const [before] = await tx<{
      version: number;
    }>`select version from cms_media where shop_id=${SHOP} and id=${data.id} and archived_at is null for update`;
    if (!before) throw new Error("Bild nicht gefunden oder bereits entfernt.");
    if (before.version !== data.expectedVersion)
      throw new Error("Das Bild wurde zwischenzeitlich geändert. Bitte neu laden.");
    const [row] = await tx.query<MediaRow>(
      `update cms_media set alt=$1,caption=$2,approved=$3,version=version+1,updated_at=now() where shop_id=$4 and id=$5 returning ${columns}`,
      [data.alt, data.caption, data.approved, SHOP, data.id],
    );
    return media(row);
  });
}

export async function archiveStudioMedia(sql: Sql, id: string, expectedVersion: number) {
  if (!isStudioMediaId(id) || !Number.isInteger(expectedVersion) || expectedVersion < 1)
    throw new Error("Ungültige Bildangaben.");
  return sql.transaction(async (tx) => {
    const [before] = await tx<{
      version: number;
    }>`select version from cms_media where shop_id=${SHOP} and id=${id} and archived_at is null for update`;
    if (!before) throw new Error("Bild nicht gefunden oder bereits entfernt.");
    if (before.version !== expectedVersion)
      throw new Error("Das Bild wurde zwischenzeitlich geändert. Bitte neu laden.");
    await tx`update cms_media set approved=false,archived_at=now(),updated_at=now(),version=version+1 where shop_id=${SHOP} and id=${id}`;
    return { ok: true as const };
  });
}

/** No mutation, fallback to another store, customer-photo access or shared caching. */
export async function readStudioMedia(
  sql: Sql,
  id: string,
  directory: string,
  preview = false,
): Promise<Buffer | null> {
  if (!isStudioMediaId(id)) return null;
  const row = preview
    ? (
        await sql<{
          id: string;
        }>`select id from cms_media where shop_id=${SHOP} and id=${id} and archived_at is null`
      )[0]
    : (await publicMediaRows(sql, [id]))[0];
  if (!row) return null;
  return createStudioMediaStore(directory).read(id);
}
