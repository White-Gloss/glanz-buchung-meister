import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { createLegacyCmsStore } from "./cms-legacy.store.ts";

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
    (await pg.query(parts.reduce((s, part, index) => s + (index ? `$${index}` : "") + part, ""), args)).rows) as Sql;
  sql.query = async <T>(query: string, args: unknown[] = []) => (await pg.query<T>(query, args)).rows;
  sql.transaction = transaction ?? ((work) => work(sql));
  return sql;
}

async function setup(migrated = false) {
  const pg = new PGlite({ parsers: { 20: Number } });
  await pg.exec(await readFile("migrations/0003_ops.sql", "utf8"));
  if (migrated) await pg.exec(await readFile("migrations/0025_website_studio.sql", "utf8"));
  const sql = wrap(pg, (work) => pg.transaction((tx) => work(wrap(tx))));
  return { pg, sql, store: createLegacyCmsStore(sql) };
}
const content = { kind: "faq" as const, title: "Echte Frage", body: "Freigegebene Antwort", extra: "{}" };

test("Existing CMS can create, publish, edit and delete without migration 0025", async () => {
  const { pg, store } = await setup();
  try {
    const created = await store.save(content);
    const [row] = await store.list("faq");
    assert.equal(row.id, created.id);
    assert.equal(row.published, true);
    assert.equal(row.studioManaged, false);
    await store.save({ ...content, id: row.id, expectedVersion: row.version, title: "Neue Frage" });
    await assert.rejects(store.save({ ...content, id: row.id, expectedVersion: row.version }), /zwischenzeitlich/);
    await assert.rejects(store.remove({ id: row.id, kind: "faq", expectedVersion: row.version }), /zwischenzeitlich/);
    const [updated] = await store.list("faq");
    assert.equal(updated.title, "Neue Frage");
    await store.remove({ id: updated.id, kind: "faq", expectedVersion: updated.version });
    assert.deepEqual(await store.list("faq"), []);
  } finally { await pg.close(); }
});

test("Legacy writes cannot cross shops, kinds, or overwrite Studio-managed content", async () => {
  const { pg, sql, store } = await setup(true);
  try {
    const created = await store.save(content);
    const [row] = await store.list("faq");
    await assert.rejects(store.save({ ...content, id: created.id, kind: "blog", expectedVersion: row.version }), /nicht gefunden/);
    await sql`update cms_items set shop_id='other-shop' where id=${created.id}`;
    await assert.rejects(store.remove({ id: created.id, kind: "faq", expectedVersion: row.version }), /nicht gefunden/);
    await sql`update cms_items set shop_id='white-gloss',archived_at=now() where id=${created.id}`;
    const [archived] = await store.list("faq");
    assert.equal(archived.studioManaged, true);
    await assert.rejects(store.save({ ...content, id: created.id, expectedVersion: archived.version }), /Website Studio/);
    await assert.rejects(store.remove({ id: created.id, kind: "faq", expectedVersion: archived.version }), /Website Studio/);
    const [unchanged] = await sql<{ title: string }>`select title from cms_items where id=${created.id}`;
    assert.equal(unchanged.title, content.title);
  } finally { await pg.close(); }
});

test("Migration alone does not disable editing of untouched legacy entries", async () => {
  const { pg, store } = await setup(true);
  try {
    await store.save(content);
    const [row] = await store.list("faq");
    assert.equal(row.studioManaged, false);
    await store.save({ ...content, id: row.id, expectedVersion: row.version, body: "Nach Migration weiterhin bearbeitbar" });
    assert.equal((await store.list("faq"))[0].body, "Nach Migration weiterhin bearbeitbar");
  } finally { await pg.close(); }
});
