import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { emptyCmsContent } from "./cms.model.ts";
import { createCmsStore } from "./cms.store.ts";

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
    (await pg.query(parts.reduce((s, part, index) => s + (index ? `$${index}` : "") + part, ""), args)).rows) as Sql;
  sql.query = async <T>(query: string, args: unknown[] = []) => (await pg.query<T>(query, args)).rows;
  sql.transaction = transaction ?? ((work) => work(sql));
  return sql;
}

async function setup() {
  const pg = new PGlite({ parsers: { 20: Number } });
  await pg.exec(await readFile("migrations/0003_ops.sql", "utf8"));
  await pg.exec(await readFile("migrations/0025_website_studio.sql", "utf8"));
  const sql = wrap(pg, (work) => pg.transaction((tx) => work(wrap(tx))));
  let assetsApproved = true;
  const store = createCmsStore(sql, {
    actor: "operator-test",
    knownPageKeys: ["city:horb-am-neckar", "service:lackkorrektur"],
    validateAssets: async () => { if (!assetsApproved) throw new Error("Bild nicht freigegeben"); },
  });
  return { pg, sql, store, revokeAssets: () => { assetsApproved = false; } };
}

test("Draft, publish, restore and stale writes preserve the last approved public content", async () => {
  const { pg, store } = await setup();
  try {
    const a = { ...emptyCmsContent(), title: "Erster Titel", body: "Echter redaktioneller Inhalt" };
    const draft = await store.saveDraft({ key: "home", expectedDraftRevisionId: null, content: a });
    assert.equal(await store.getPublished("home"), null);
    const published = await store.publish({ key: "home", revisionId: draft.draftRevisionId!, expectedDraftRevisionId: draft.draftRevisionId, expectedPublishedRevisionId: null });
    assert.equal((await store.getPublished("home"))?.content.title, a.title);
    const b = { ...a, title: "Zweiter Titel" };
    const edited = await store.saveDraft({ key: "home", expectedDraftRevisionId: draft.draftRevisionId, content: b });
    assert.equal((await store.getPublished("home"))?.content.title, a.title);
    await assert.rejects(store.saveDraft({ key: "home", expectedDraftRevisionId: draft.draftRevisionId, content: a }), /zwischenzeitlich/);
    await assert.rejects(store.publish({ key: "home", revisionId: draft.draftRevisionId!, expectedDraftRevisionId: edited.draftRevisionId, expectedPublishedRevisionId: published.publishedRevisionId }), /aktuellen Entwurf/);
    const restored = await store.restore({ key: "home", revisionId: draft.draftRevisionId!, expectedDraftRevisionId: edited.draftRevisionId });
    assert.equal(restored.draft?.title, a.title);
    assert.notEqual(restored.draftRevisionId, draft.draftRevisionId);
    assert.equal(restored.publishedRevisionId, published.publishedRevisionId);
    assert.equal(restored.revisions.length, 3);
  } finally { await pg.close(); }
});

test("Publishing fails atomically when media approval was revoked; restore also rejects revoked media", async () => {
  const { pg, store, revokeAssets } = await setup();
  try {
    const content = { ...emptyCmsContent(), title: "Galerie", images: [{ assetId: "static:customer-01", alt: "BMW Lackfinish", caption: "" }] };
    const draft = await store.saveDraft({ key: "gallery", expectedDraftRevisionId: null, content });
    revokeAssets();
    await assert.rejects(store.publish({ key: "gallery", revisionId: draft.draftRevisionId!, expectedDraftRevisionId: draft.draftRevisionId, expectedPublishedRevisionId: null }), /nicht freigegeben/);
    assert.equal(await store.getPublished("gallery"), null);
    await assert.rejects(store.restore({ key: "gallery", revisionId: draft.draftRevisionId!, expectedDraftRevisionId: draft.draftRevisionId }), /nicht freigegeben/);
    assert.equal((await store.getDocument("gallery")).revisions.length, 1);
  } finally { await pg.close(); }
});

test("Two simultaneous editors with the same revision cannot both save", async () => {
  const { pg, store } = await setup();
  try {
    const content = { ...emptyCmsContent(), title: "Ausgangsfassung" };
    const initial = await store.saveDraft({ key: "home", expectedDraftRevisionId: null, content });
    const results = await Promise.allSettled([
      store.saveDraft({ key: "home", expectedDraftRevisionId: initial.draftRevisionId, content: { ...content, title: "Editor A" } }),
      store.saveDraft({ key: "home", expectedDraftRevisionId: initial.draftRevisionId, content: { ...content, title: "Editor B" } }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const document = await store.getDocument("home");
    assert.equal(document.revisions.length, 2);
    assert.ok(["Editor A", "Editor B"].includes(document.draft!.title));
    assert.equal(await store.getPublished("home"), null);
  } finally { await pg.close(); }
});

test("Legacy content remains published while its first Studio change becomes a draft", async () => {
  const { pg, sql, store } = await setup();
  try {
    const [row] = await sql<{ id: number }>`insert into cms_items(kind,title,body,extra,published) values('faq','Bestehende Frage','Bestehende Antwort','{"note":"unverändert"}',true) returning id`;
    const key = `legacy:${row.id}` as const;
    const before = await store.getDocument(key);
    assert.equal(before.published?.body, "Bestehende Antwort");
    const next = await store.saveDraft({ key, expectedDraftRevisionId: null, content: { ...before.published!, body: "Neue Antwort" } });
    assert.equal((await sql<{ body: string }>`select body from cms_items where id=${row.id}`)[0].body, "Bestehende Antwort");
    assert.equal(next.revisions.length, 2, "first edit retains the original published baseline as a revision");
    await store.publish({ key, revisionId: next.draftRevisionId!, expectedDraftRevisionId: next.draftRevisionId, expectedPublishedRevisionId: next.publishedRevisionId });
    const [current] = await sql<{ body: string; extra: string }>`select body,extra from cms_items where id=${row.id}`;
    assert.equal(current.body, "Neue Antwort");
    assert.equal(current.extra, '{"note":"unverändert"}');
  } finally { await pg.close(); }
});

test("Cross-document revisions, foreign shop rows, unknown IDs and stale archive requests are rejected", async () => {
  const { pg, sql, store } = await setup();
  try {
    const content = { ...emptyCmsContent(), title: "Inhalt" };
    const first = await store.saveDraft({ key: "home", expectedDraftRevisionId: null, content });
    const second = await store.saveDraft({ key: "about", expectedDraftRevisionId: null, content });
    await assert.rejects(store.restore({ key: "home", revisionId: second.draftRevisionId!, expectedDraftRevisionId: first.draftRevisionId }), /Fassung nicht gefunden/);
    const [foreign] = await sql<{ id: number }>`insert into cms_items(shop_id,kind,title) values('foreign-shop','faq','Privat') returning id`;
    await assert.rejects(store.getDocument(`legacy:${foreign.id}`), /nicht gefunden/);
    await assert.rejects(store.getDocument("legacy:999999"), /nicht gefunden/);
    await assert.rejects(store.archive({ key: "home", expectedDraftRevisionId: null, expectedPublishedRevisionId: null }), /zwischenzeitlich/);
    await store.archive({ key: "home", expectedDraftRevisionId: first.draftRevisionId, expectedPublishedRevisionId: null });
    assert.equal(await store.getPublished("home"), null);
    assert.equal((await store.getDocument("home")).revisions.length, 1, "archive retains history");
  } finally { await pg.close(); }
});

test("Archived drafts reject previously valid publish and save requests until explicitly restored", async () => {
  const { pg, store } = await setup();
  try {
    const content = { ...emptyCmsContent(), title: "Entwurf" };
    const draft = await store.saveDraft({ key: "about", expectedDraftRevisionId: null, content });
    const payload = { key: "about" as const, revisionId: draft.draftRevisionId!, expectedDraftRevisionId: draft.draftRevisionId, expectedPublishedRevisionId: null };
    const archived = await store.archive(payload);
    assert.equal(archived.draftRevisionId, null);
    await assert.rejects(store.publish(payload), /Archivierte/);
    await assert.rejects(store.saveDraft({ key: "about", expectedDraftRevisionId: draft.draftRevisionId, content }), /archiviert/);
    const restored = await store.restore({ key: "about", revisionId: draft.draftRevisionId!, expectedDraftRevisionId: null });
    assert.equal(restored.archived, false);
    assert.equal(restored.published, null);
    assert.equal(await store.getPublished("about"), null);
  } finally { await pg.close(); }
});

test("Direct database roles cannot read private revisions or media metadata", async () => {
  const { pg, sql } = await setup();
  try {
    const [item] = await sql<{ id: number }>`insert into cms_items(kind,title) values('faq','Private question') returning id`;
    await sql`insert into cms_revisions(item_id,content,created_by) values(${item.id},'{}','private-actor')`;
    await sql`insert into cms_media(id,original_name,created_by,width,height,bytes,sha256) values('c7894f33-218a-4006-822e-5d8d911b7446','private.jpg','private-actor',1,1,1,${"a".repeat(64)})`;
    await pg.exec("create role studio_anon nologin; grant usage on schema public to studio_anon; set role studio_anon;");
    await assert.rejects(sql.query("select * from cms_revisions"), /permission denied/);
    await assert.rejects(sql.query("select * from cms_media"), /permission denied/);
    await pg.exec("reset role;");
    // Even accidentally reintroduced table grants cannot expose or alter a row.
    await pg.exec("grant select,insert,update,delete on cms_revisions,cms_media to studio_anon; grant usage,select on sequence cms_revisions_id_seq to studio_anon; set role studio_anon;");
    assert.deepEqual(await sql.query("select * from cms_revisions"), []);
    assert.deepEqual(await sql.query("select * from cms_media"), []);
    assert.deepEqual(await sql.query("update cms_revisions set created_by='attacker' returning id"), []);
    assert.deepEqual(await sql.query("update cms_media set approved=true returning id"), []);
    assert.deepEqual(await sql.query("delete from cms_revisions returning id"), []);
    assert.deepEqual(await sql.query("delete from cms_media returning id"), []);
    await assert.rejects(sql.query("insert into cms_revisions(item_id,content,created_by) values($1,'{}','attacker')", [item.id]), /row-level security/);
    await assert.rejects(sql.query("insert into cms_media(id,original_name,created_by,width,height,bytes,sha256) values('b7894f33-218a-4006-822e-5d8d911b7446','x.jpg','attacker',1,1,1,$1)", ["b".repeat(64)]), /row-level security/);
    await pg.exec("reset role;");
    const flags = await sql<{ relrowsecurity: boolean }>`select relrowsecurity from pg_class where relname in ('cms_revisions','cms_media') order by relname`;
    assert.deepEqual(flags.map((row) => row.relrowsecurity), [true, true]);
    assert.equal((await sql.query("select * from cms_revisions")).length, 1);
    assert.equal((await sql.query("select * from cms_media")).length, 1);
  } finally { await pg.close(); }
});

test("Studio migration removes inherited anonymous and authenticated table grants", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(await readFile("migrations/0003_ops.sql", "utf8"));
    await pg.exec("create role anon nologin; create role authenticated nologin; alter default privileges in schema public grant all on tables to anon,authenticated; alter default privileges in schema public grant all on sequences to anon,authenticated;");
    await pg.exec(await readFile("migrations/0025_website_studio.sql", "utf8"));
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["cms_revisions", "cms_media"]) {
        const result = await pg.query<{ allowed: boolean }>("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') as allowed", [role, table]);
        assert.equal(result.rows[0].allowed, false);
      }
      const sequence = await pg.query<{ allowed: boolean }>("select has_sequence_privilege($1,'cms_revisions_id_seq','USAGE,SELECT,UPDATE') as allowed", [role]);
      assert.equal(sequence.rows[0].allowed, false);
    }
  } finally { await pg.close(); }
});
