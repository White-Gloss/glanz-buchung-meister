import type { Sql } from "./db.ts";

const SHOP = "white-gloss";
export type LegacyCmsKind = "faq" | "blog" | "gallery" | "service";
export type LegacyCmsRow = {
  id: number; kind: LegacyCmsKind; slug: string | null; title: string; body: string;
  extra: string; published: boolean; sort: number; version: string; studioManaged: boolean;
};
type StoredRow = Omit<LegacyCmsRow, "studioManaged"> & { metadata: Record<string, unknown> };
type SaveInput = {
  id?: number; kind: LegacyCmsKind; expectedVersion?: string; slug?: string;
  title: string; body: string; extra?: string;
};
type RemoveInput = { id: number; kind: LegacyCmsKind; expectedVersion: string };

function managed(row: StoredRow): boolean {
  return ["studio_key", "draft_revision_id", "published_revision_id", "archived_at"]
    .some((key) => row.metadata[key] != null);
}

/** Uses only the established cms_items schema. No Studio migration is needed. */
export function createLegacyCmsStore(sql: Sql) {
  async function list(kind: LegacyCmsKind): Promise<LegacyCmsRow[]> {
    const rows = await sql<StoredRow>`select i.id,i.kind,i.slug,i.title,i.body,i.extra,i.published,i.sort,i.updated_at::text as version,to_jsonb(i) as metadata from cms_items i where i.shop_id=${SHOP} and i.kind=${kind} order by i.sort asc,i.id desc`;
    return rows.map((row) => {
      const { metadata: _metadata, ...data } = row;
      return { ...data, studioManaged: managed(row) };
    });
  }

  async function editable(tx: Sql, input: { id: number; kind: LegacyCmsKind; expectedVersion?: string }) {
    const [row] = await tx<StoredRow>`select i.id,i.kind,i.slug,i.title,i.body,i.extra,i.published,i.sort,i.updated_at::text as version,to_jsonb(i) as metadata from cms_items i where i.shop_id=${SHOP} and i.id=${input.id} and i.kind=${input.kind} for update`;
    if (!row) throw new Error("Inhalt nicht gefunden.");
    // Once the Studio owns an item, its immutable history must remain authoritative
    // even during a rollback. A legacy request must never bypass those revisions.
    if (managed(row)) throw new Error("Dieser Inhalt hat bereits Website-Studio-Fassungen. Bitte Website Studio wieder aktivieren lassen, um ihn sicher zu bearbeiten.");
    if (!input.expectedVersion || input.expectedVersion !== row.version) {
      throw new Error("Der Inhalt wurde zwischenzeitlich geändert. Bitte neu laden und die Angaben vergleichen.");
    }
    return row;
  }

  async function save(input: SaveInput): Promise<{ id: number }> {
    return sql.transaction(async (tx) => {
      if (input.id) {
        const current = await editable(tx, { ...input, id: input.id });
        const [row] = await tx<{ id: number }>`update cms_items set slug=${input.slug || null},title=${input.title},body=${input.body},extra=${input.extra ?? current.extra},published=true,updated_at=clock_timestamp() where shop_id=${SHOP} and id=${input.id} and kind=${input.kind} returning id`;
        return row;
      }
      const [row] = await tx<{ id: number }>`insert into cms_items(shop_id,kind,slug,title,body,extra,published,sort) values(${SHOP},${input.kind},${input.slug || null},${input.title},${input.body},${input.extra ?? "{}"},true,0) returning id`;
      return row;
    });
  }

  async function remove(input: RemoveInput): Promise<{ ok: true }> {
    return sql.transaction(async (tx) => {
      await editable(tx, input);
      await tx`delete from cms_items where shop_id=${SHOP} and id=${input.id} and kind=${input.kind}`;
      return { ok: true };
    });
  }
  return { list, save, remove };
}
