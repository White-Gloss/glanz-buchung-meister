import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { getSql } from "@/lib/db";
import { cities, services } from "@/data/site";
import { emptyCmsContent, parseCmsContent, parseCmsDocumentKey, type CmsDocumentKey } from "./cms.model";
import { createCmsStore, isCmsSchemaUnavailable, type CmsStudioDocument } from "./cms.store";
import { cmsEnabled, createOptionalCmsReader } from "./cms.availability";

export type { CmsDocumentContent, CmsDocumentKey } from "./cms.model";
export type { CmsKind, CmsStudioDocument, CmsStudioSummary } from "./cms.store";

const SHOP = "white-gloss";
const knownPageKeys = [...services.map((service) => `service:${service.slug}`), ...cities.map((city) => `city:${city.slug}`)];
const kindSchema = z.enum(["faq", "blog", "gallery", "service"]);
const revisionId = z.number().int().positive().nullable();
const keySchema = z.unknown().transform((value) => parseCmsDocumentKey(value, knownPageKeys));
const contentSchema = z.unknown().transform(parseCmsContent);
const readOptionalCms = createOptionalCmsReader({
  enabled: studioEnabled,
  onFailure: (reason) => console.warn(`[cms] Published content ${reason}; existing static content is used.`),
});

async function studioEnabled() {
  const { isIsolatedGithubCi } = await import("../../scripts/hosting-policy.mjs");
  return cmsEnabled({ enabled: process.env.WEBSITE_STUDIO_ENABLED, isolatedCi: isIsolatedGithubCi() });
}

export type CmsRow = {
  id: number; kind: string; slug: string | null; title: string; body: string; extra: string;
  published: boolean; sort: number; created_at: string; updated_at: string;
};

async function studioStore(actor?: string) {
  if (!(await studioEnabled())) throw new Error("Website Studio ist noch nicht freigeschaltet. Datenbank, Medienspeicher und Veröffentlichung benötigen die separate Einrichtungsfreigabe.");
  if (actor && process.env.NODE_ENV === "production" && !process.env.DATABASE_URL?.trim()) {
    const { isIsolatedGithubCi } = await import("../../scripts/hosting-policy.mjs");
    if (!isIsolatedGithubCi()) throw new Error("Website Studio benötigt die persistente Datenbank. Bitte die Einrichtung prüfen lassen.");
  }
  const sql = await getSql();
  const { validateCmsAssetsForPublication } = await import("./studio-media.server");
  return { sql, store: createCmsStore(sql, { actor, knownPageKeys, validateAssets: validateCmsAssetsForPublication }) };
}

async function studioOperation<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (isCmsSchemaUnavailable(error)) throw new Error("Website Studio ist noch nicht freigeschaltet. Die vorbereitete Datenbank-Erweiterung muss separat geprüft und freigegeben werden.");
    throw error;
  }
}

async function withPreviewAssets(sql: Awaited<ReturnType<typeof getSql>>, document: CmsStudioDocument) {
  const { resolveCmsAssets } = await import("./studio-media.server");
  const content = document.draft ?? document.published;
  return { ...document, assets: content ? await resolveCmsAssets(sql, content, { preview: true }) : [] };
}

export const listCmsStudioDocuments = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => studioOperation(async () => {
    const { store } = await studioStore(context.userId);
    return store.listDocuments();
  }));

export const getCmsStudioDocument = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ key: keySchema }).strict().parse(input))
  .handler(async ({ data, context }) => studioOperation(async () => {
    const { sql, store } = await studioStore(context.userId);
    return withPreviewAssets(sql, await store.getDocument(data.key));
  }));

export const saveCmsDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ key: keySchema, expectedDraftRevisionId: revisionId, content: contentSchema }).strict().parse(input))
  .handler(async ({ data, context }) => studioOperation(async () => {
    const { sql, store } = await studioStore(context.userId);
    return withPreviewAssets(sql, await store.saveDraft(data));
  }));

export const publishCmsRevision = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ key: keySchema, revisionId: z.number().int().positive(), expectedDraftRevisionId: revisionId, expectedPublishedRevisionId: revisionId }).strict().parse(input))
  .handler(async ({ data, context }) => studioOperation(async () => {
    const { sql, store } = await studioStore(context.userId);
    return withPreviewAssets(sql, await store.publish(data));
  }));

export const restoreCmsRevisionAsDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ key: keySchema, revisionId: z.number().int().positive(), expectedDraftRevisionId: revisionId }).strict().parse(input))
  .handler(async ({ data, context }) => studioOperation(async () => {
    const { sql, store } = await studioStore(context.userId);
    return withPreviewAssets(sql, await store.restore(data));
  }));

export const archiveCmsDocument = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ key: keySchema, expectedDraftRevisionId: revisionId, expectedPublishedRevisionId: revisionId }).strict().parse(input))
  .handler(async ({ data, context }) => studioOperation(async () => {
    const { sql, store } = await studioStore(context.userId);
    return withPreviewAssets(sql, await store.archive(data));
  }));

export const getPublishedCmsDocument = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ key: keySchema }).strict().parse(input))
  .handler(async ({ data }) => {
    return readOptionalCms(data.key, async () => {
      const { sql, store } = await studioStore();
      const document = await store.getPublished(data.key);
      if (!document) return null;
      const { resolveCmsAssets } = await import("./studio-media.server");
      return { ...document, assets: await resolveCmsAssets(sql, document.content) };
    });
  });

/** Existing public FAQ/blog/service consumers retain their established projection. */
export const listPublishedCms = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ kind: kindSchema }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<CmsRow>`select id,kind,slug,title,body,extra,published,sort,created_at,updated_at from cms_items where shop_id=${SHOP} and kind=${data.kind} and published=true order by sort asc,id desc`;
  });

export const listCms = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ kind: kindSchema }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<CmsRow>`select id,kind,slug,title,body,extra,published,sort,created_at,updated_at from cms_items where shop_id=${SHOP} and kind=${data.kind} order by sort asc,id desc`;
  });

/** Compatibility endpoint: old callers may save drafts, but cannot publish directly. */
export const upsertCms = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({
    id: z.number().int().positive().optional(), kind: kindSchema,
    slug: z.string().max(80).optional(), title: z.string().trim().min(2).max(200),
    body: z.string().max(20000), extra: z.string().max(4000).optional(),
    published: z.boolean().optional(), sort: z.number().int().optional(),
    expectedDraftRevisionId: revisionId.optional(),
  }).strict().parse(input))
  .handler(async ({ data, context }) => studioOperation(async () => {
    const { sql } = await studioStore(context.userId);
    if (data.id && data.expectedDraftRevisionId === undefined) throw new Error("Bitte den Eintrag im Website Studio neu laden. Die Fassung muss vor dem Speichern geprüft werden.");
    if (data.id && (data.slug !== undefined || data.extra !== undefined || data.sort !== undefined)) throw new Error("Bitte Metadaten im Website Studio bearbeiten.");
    return sql.transaction(async (tx) => {
      let id = data.id;
      if (!id) {
        const [created] = await tx<{ id: number }>`insert into cms_items(shop_id,kind,slug,title,body,extra,published,sort) values(${SHOP},${data.kind},${data.slug || null},'Neuer Entwurf','',${data.extra ?? "{}"},false,${data.sort ?? 0}) returning id`;
        id = created.id;
      }
      const { validateCmsAssetsForPublication } = await import("./studio-media.server");
      const store = createCmsStore(tx, { actor: context.userId, knownPageKeys, validateAssets: validateCmsAssetsForPublication });
      const document = await store.saveDraft({ key: `legacy:${id}` as CmsDocumentKey, expectedDraftRevisionId: data.expectedDraftRevisionId ?? null, content: { ...emptyCmsContent(), title: data.title, body: data.body } });
      return { id: document.id, draftRevisionId: document.draftRevisionId, published: false as const };
    });
  }));

/** Retains all revisions; old clients without a version cannot delete a newer edit. */
export const deleteCms = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ id: z.number().int().positive(), expectedDraftRevisionId: revisionId, expectedPublishedRevisionId: revisionId }).strict().parse(input))
  .handler(async ({ data, context }) => studioOperation(async () => {
    const { store } = await studioStore(context.userId);
    await store.archive({ key: `legacy:${data.id}`, expectedDraftRevisionId: data.expectedDraftRevisionId, expectedPublishedRevisionId: data.expectedPublishedRevisionId });
    return { ok: true as const };
  }));

