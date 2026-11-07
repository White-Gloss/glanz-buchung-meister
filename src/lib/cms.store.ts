import type { Sql } from "./db.ts";
import { assertCmsRevision, emptyCmsContent, parseCmsContent, parseCmsDocumentKey, type CmsDocumentContent, type CmsDocumentKey } from "./cms.model.ts";

const SHOP = "white-gloss";
export type CmsKind = "faq" | "blog" | "gallery" | "service" | "page";
type Item = { id: number; kind: CmsKind; studio_key: string | null; slug: string | null; title: string; body: string; extra: string; published: boolean; sort: number; draft_revision_id: number | null; published_revision_id: number | null; archived_at: string | null; updated_at: string };
type Revision = { id: number; content: CmsDocumentContent; created_by: string; created_at: string; restored_from_revision_id: number | null };
export type CmsRevisionSummary = { id: number; createdAt: string; createdBy: string; restoredFromRevisionId: number | null };
export type CmsStudioDocument = { id: number | null; key: CmsDocumentKey; kind: CmsKind; draftRevisionId: number | null; publishedRevisionId: number | null; draft: CmsDocumentContent | null; published: CmsDocumentContent | null; revisions: CmsRevisionSummary[]; archived: boolean };
export type CmsStudioSummary = { id: number; key: CmsDocumentKey; kind: CmsKind; title: string; draftRevisionId: number | null; publishedRevisionId: number | null; updatedAt: string; archived: boolean };
type DraftInput = { key: CmsDocumentKey; expectedDraftRevisionId: number | null; content: CmsDocumentContent };
type PublishInput = { key: CmsDocumentKey; revisionId: number; expectedDraftRevisionId: number | null; expectedPublishedRevisionId: number | null };
type RestoreInput = { key: CmsDocumentKey; revisionId: number; expectedDraftRevisionId: number | null };
type ArchiveInput = Omit<PublishInput, "revisionId">;

function kindForKey(key: CmsDocumentKey): CmsKind {
  if (key.startsWith("faq:")) return "faq";
  if (key.startsWith("blog:")) return "blog";
  return "page";
}

function legacyContent(item: Item): CmsDocumentContent {
  return { ...emptyCmsContent(), title: item.title, body: item.body };
}

function iso(value: string | Date): string { return value instanceof Date ? value.toISOString() : value; }

/** Schema rollout is explicit. Only these missing Studio objects permit public fallback. */
export function isCmsSchemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return (code === "42P01" || code === "42703") && /cms_revisions|cms_media|studio_key|draft_revision_id|published_revision_id|archived_at/.test(message ?? "");
}

/** The transaction is the write boundary; public reads never create a baseline or revision. */
export function createCmsStore(sql: Sql, options: {
  actor?: string;
  knownPageKeys: readonly string[];
  validateAssets: (tx: Sql, content: CmsDocumentContent) => Promise<void>;
}) {
  const keyOf = (input: unknown) => parseCmsDocumentKey(input, options.knownPageKeys);
  function actor(): string {
    if (!options.actor?.trim()) throw new Error("Kein Betriebszugang.");
    return options.actor;
  }

  async function find(tx: Sql, key: CmsDocumentKey, lock = false): Promise<Item | null> {
    const legacyId = key.startsWith("legacy:") ? Number(key.slice(7)) : null;
    const rows = await tx.query<Item>(
      `select id,kind,studio_key,slug,title,body,extra,published,sort,draft_revision_id,published_revision_id,archived_at,updated_at from cms_items where shop_id=$1 and ${legacyId === null ? "studio_key=$2" : "id=$2"}${lock ? " for update" : ""}`,
      [SHOP, legacyId ?? key],
    );
    if (!rows[0] && legacyId !== null) throw new Error("Inhalt nicht gefunden.");
    return rows[0] ?? null;
  }

  async function revision(tx: Sql, itemId: number, id: number): Promise<Revision> {
    const [row] = await tx<Revision>`select id,content,created_by,created_at,restored_from_revision_id from cms_revisions where shop_id=${SHOP} and item_id=${itemId} and id=${id}`;
    if (!row) throw new Error("Fassung nicht gefunden.");
    return { ...row, content: parseCmsContent(row.content) };
  }

  async function readDocument(tx: Sql, key: CmsDocumentKey): Promise<CmsStudioDocument> {
    const item = await find(tx, key);
    if (!item) return { id: null, key, kind: kindForKey(key), draftRevisionId: null, publishedRevisionId: null, draft: null, published: null, revisions: [], archived: false };
    const rows = await tx<Revision>`select id,content,created_by,created_at,restored_from_revision_id from cms_revisions where shop_id=${SHOP} and item_id=${item.id} order by id desc limit 100`;
    const draft = item.draft_revision_id ? await revision(tx, item.id, item.draft_revision_id) : null;
    const published = item.published && !item.archived_at
      ? item.published_revision_id ? (await revision(tx, item.id, item.published_revision_id)).content : legacyContent(item)
      : null;
    return {
      id: item.id, key, kind: item.kind,
      draftRevisionId: item.draft_revision_id,
      publishedRevisionId: item.published_revision_id,
      draft: draft?.content ?? published,
      published,
      revisions: rows.map((row) => ({ id: row.id, createdAt: iso(row.created_at), createdBy: row.created_by, restoredFromRevisionId: row.restored_from_revision_id })),
      archived: Boolean(item.archived_at),
    };
  }

  async function addRevision(tx: Sql, item: Item, content: CmsDocumentContent, restoredFrom: number | null = null): Promise<number> {
    const [row] = await tx<{ id: number }>`insert into cms_revisions(shop_id,item_id,content,created_by,restored_from_revision_id) values(${SHOP},${item.id},${JSON.stringify(content)}::jsonb,${actor()},${restoredFrom}) returning id`;
    return row.id;
  }

  async function preserveLegacyBaseline(tx: Sql, item: Item): Promise<void> {
    if (item.published && !item.published_revision_id) {
      const baseline = await addRevision(tx, item, legacyContent(item));
      await tx`update cms_items set published_revision_id=${baseline} where shop_id=${SHOP} and id=${item.id}`;
      item.published_revision_id = baseline;
    }
  }

  async function ensureItem(tx: Sql, key: CmsDocumentKey): Promise<Item> {
    let item = await find(tx, key, true);
    if (item) return item;
    const kind = kindForKey(key);
    const slug = kind === "page" ? key : key.slice(key.indexOf(":") + 1);
    await tx`insert into cms_items(shop_id,kind,slug,title,body,extra,published,studio_key) values(${SHOP},${kind},${slug},'Neuer Entwurf','','{}',false,${key}) on conflict(shop_id,studio_key) do nothing`;
    item = await find(tx, key, true);
    if (!item) throw new Error("Entwurf konnte nicht angelegt werden.");
    return item;
  }

  async function saveDraft(input: DraftInput): Promise<CmsStudioDocument> {
    actor();
    const key = keyOf(input.key);
    const content = parseCmsContent(input.content);
    return sql.transaction(async (tx) => {
      const item = await ensureItem(tx, key);
      if (item.archived_at) throw new Error("Dieser Inhalt ist archiviert. Bitte zuerst bewusst eine Fassung als Entwurf wiederherstellen.");
      assertCmsRevision(item.draft_revision_id, input.expectedDraftRevisionId);
      await preserveLegacyBaseline(tx, item);
      const id = await addRevision(tx, item, content);
      await tx`update cms_items set draft_revision_id=${id},archived_at=null,updated_at=now() where shop_id=${SHOP} and id=${item.id}`;
      return readDocument(tx, key);
    });
  }

  async function publish(input: PublishInput): Promise<CmsStudioDocument> {
    actor();
    const key = keyOf(input.key);
    return sql.transaction(async (tx) => {
      const item = await find(tx, key, true);
      if (!item) throw new Error("Inhalt nicht gefunden.");
      if (item.archived_at) throw new Error("Archivierte Inhalte können nicht veröffentlicht werden. Bitte zuerst eine Fassung als Entwurf wiederherstellen.");
      assertCmsRevision(item.draft_revision_id, input.expectedDraftRevisionId);
      assertCmsRevision(item.published_revision_id, input.expectedPublishedRevisionId);
      if (item.draft_revision_id !== input.revisionId) throw new Error("Bitte den aktuellen Entwurf vor der Veröffentlichung prüfen.");
      const { content } = await revision(tx, item.id, input.revisionId);
      if (content.title.trim().length < 2) throw new Error("Bitte vor der Veröffentlichung einen Titel ergänzen.");
      if (content.images.some((image) => !image.alt.trim())) throw new Error("Bitte für jedes Bild einen beschreibenden Alt-Text ergänzen.");
      await options.validateAssets(tx, content);
      await tx`update cms_items set title=${content.title},body=${content.body},published=true,published_revision_id=${input.revisionId},archived_at=null,updated_at=now() where shop_id=${SHOP} and id=${item.id}`;
      return readDocument(tx, key);
    });
  }

  async function restore(input: RestoreInput): Promise<CmsStudioDocument> {
    actor();
    const key = keyOf(input.key);
    return sql.transaction(async (tx) => {
      const item = await find(tx, key, true);
      if (!item) throw new Error("Inhalt nicht gefunden.");
      assertCmsRevision(item.draft_revision_id, input.expectedDraftRevisionId);
      const source = await revision(tx, item.id, input.revisionId);
      await options.validateAssets(tx, source.content);
      const id = await addRevision(tx, item, source.content, source.id);
      await tx`update cms_items set draft_revision_id=${id},archived_at=null,updated_at=now() where shop_id=${SHOP} and id=${item.id}`;
      return readDocument(tx, key);
    });
  }

  async function archive(input: ArchiveInput): Promise<CmsStudioDocument> {
    actor();
    const key = keyOf(input.key);
    return sql.transaction(async (tx) => {
      const item = await find(tx, key, true);
      if (!item) throw new Error("Inhalt nicht gefunden.");
      assertCmsRevision(item.draft_revision_id, input.expectedDraftRevisionId);
      assertCmsRevision(item.published_revision_id, input.expectedPublishedRevisionId);
      await preserveLegacyBaseline(tx, item);
      await tx`update cms_items set published=false,draft_revision_id=null,published_revision_id=null,archived_at=now(),updated_at=now() where shop_id=${SHOP} and id=${item.id}`;
      return readDocument(tx, key);
    });
  }

  async function getPublished(input: CmsDocumentKey): Promise<{ content: CmsDocumentContent; revisionId: number | null } | null> {
    const key = keyOf(input);
    const item = await find(sql, key);
    if (!item?.published || item.archived_at) return null;
    return { content: item.published_revision_id ? (await revision(sql, item.id, item.published_revision_id)).content : legacyContent(item), revisionId: item.published_revision_id };
  }

  async function listDocuments(): Promise<CmsStudioSummary[]> {
    const rows = await sql<Item>`select i.id,i.kind,i.studio_key,i.slug,coalesce(r.content->>'title',i.title) as title,i.body,i.extra,i.published,i.sort,i.draft_revision_id,i.published_revision_id,i.archived_at,i.updated_at from cms_items i left join cms_revisions r on r.shop_id=i.shop_id and r.item_id=i.id and r.id=i.draft_revision_id where i.shop_id=${SHOP} order by i.updated_at desc,i.id desc`;
    return rows.map((item) => ({ id: item.id, key: (item.studio_key ?? `legacy:${item.id}`) as CmsDocumentKey, kind: item.kind, title: item.title, draftRevisionId: item.draft_revision_id, publishedRevisionId: item.published_revision_id, updatedAt: iso(item.updated_at), archived: Boolean(item.archived_at) }));
  }

  return { getDocument: (key: CmsDocumentKey) => readDocument(sql, keyOf(key)), getPublished, listDocuments, saveDraft, publish, restore, archive };
}
