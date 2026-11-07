import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";
import type { Sql } from "./db.ts";
import { emptyCmsContent } from "./cms.model.ts";
import { createCmsStore } from "./cms.store.ts";
import {
  archiveStudioMedia,
  changeStudioMedia,
  listStudioMedia,
  parseStudioMediaChange,
  readStudioMedia,
  resolveCmsAssets,
  storeStudioImage,
  validateCmsAssetsForPublication,
} from "./studio-media.server.ts";

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
    (
      await pg.query(
        parts.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""),
        args,
      )
    ).rows) as Sql;
  sql.query = async <T>(query: string, args: unknown[] = []) =>
    (await pg.query<T>(query, args)).rows;
  sql.transaction = transaction ?? ((work) => work(sql));
  return sql;
}

async function setup() {
  const pg = new PGlite({ parsers: { 20: Number } });
  await pg.exec(await readFile("migrations/0003_ops.sql", "utf8"));
  await pg.exec(await readFile("migrations/0025_website_studio.sql", "utf8"));
  const sql = wrap(pg, (work) => pg.transaction((tx) => work(wrap(tx))));
  const directory = await mkdtemp(join(tmpdir(), "wg-studio-media-db-test-"));
  const store = createCmsStore(sql, {
    actor: "operator-test",
    knownPageKeys: [],
    validateAssets: validateCmsAssetsForPublication,
  });
  return {
    pg,
    sql,
    directory,
    store,
    async close() {
      await pg.close();
      const contained = relative(resolve(tmpdir()), resolve(directory));
      assert.ok(contained && !contained.startsWith(`..${sep}`));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

async function imageFile() {
  const data = await sharp({ create: { width: 8, height: 4, channels: 3, background: "#8899aa" } })
    .png()
    .toBuffer();
  return new File([new Uint8Array(data)], "werkstatt.png", { type: "image/png" });
}

test("upload, approval and publication are separate; revocation immediately closes public and preview URLs", async () => {
  const context = await setup();
  const { sql, store, directory } = context;
  try {
    const uploaded = await storeStudioImage(sql, await imageFile(), "operator-test", directory);
    assert.equal(uploaded.approved, false);
    assert.equal(
      await readStudioMedia(sql, uploaded.id, directory),
      null,
      "new uploads are private",
    );
    assert.ok(await readStudioMedia(sql, uploaded.id, directory, true));
    const content = {
      ...emptyCmsContent(),
      title: "Galerie",
      images: [{ assetId: uploaded.id, alt: "Aufbereitetes Fahrzeug", caption: "" }],
      heroAssetId: uploaded.id,
    };
    const draft = await store.saveDraft({ key: "gallery", content, expectedDraftRevisionId: null });
    await assert.rejects(
      store.publish({
        key: "gallery",
        revisionId: draft.draftRevisionId!,
        expectedDraftRevisionId: draft.draftRevisionId,
        expectedPublishedRevisionId: null,
      }),
      /nicht zur Veröffentlichung/,
    );
    const approved = await changeStudioMedia(sql, {
      id: uploaded.id,
      expectedVersion: 1,
      alt: "Aufbereitetes Fahrzeug",
      caption: "",
      approved: true,
    });
    assert.equal(approved.version, 2);
    assert.equal(
      await readStudioMedia(sql, uploaded.id, directory),
      null,
      "approval alone does not publish a file",
    );
    await assert.rejects(
      changeStudioMedia(sql, {
        id: uploaded.id,
        expectedVersion: 1,
        alt: "Veraltet",
        caption: "",
        approved: false,
      }),
      /zwischenzeitlich/,
    );
    await store.publish({
      key: "gallery",
      revisionId: draft.draftRevisionId!,
      expectedDraftRevisionId: draft.draftRevisionId,
      expectedPublishedRevisionId: null,
    });
    const bytes = await readStudioMedia(sql, uploaded.id, directory);
    assert.ok(bytes);
    assert.equal((await sharp(bytes).metadata()).format, "webp");
    assert.equal((await resolveCmsAssets(sql, content))[0].id, uploaded.id);
    await archiveStudioMedia(sql, uploaded.id, 2);
    assert.equal(await readStudioMedia(sql, uploaded.id, directory), null);
    assert.equal(await readStudioMedia(sql, uploaded.id, directory, true), null);
    assert.deepEqual(await resolveCmsAssets(sql, content), []);
    assert.deepEqual((await listStudioMedia(sql)).uploads, []);
    await assert.rejects(
      store.restore({
        key: "gallery",
        revisionId: draft.draftRevisionId!,
        expectedDraftRevisionId: draft.draftRevisionId,
      }),
      /nicht zur Veröffentlichung/,
    );
  } finally {
    await context.close();
  }
});

test("old revisions and drafts do not keep an otherwise unreferenced file publicly accessible", async () => {
  const context = await setup();
  const { sql, store, directory } = context;
  try {
    const uploaded = await storeStudioImage(sql, await imageFile(), "operator-test", directory);
    await changeStudioMedia(sql, {
      id: uploaded.id,
      expectedVersion: 1,
      alt: "Fahrzeug",
      caption: "",
      approved: true,
    });
    const content = {
      ...emptyCmsContent(),
      title: "Bilder",
      images: [{ assetId: uploaded.id, alt: "Fahrzeug", caption: "" }],
    };
    const draft = await store.saveDraft({ key: "gallery", content, expectedDraftRevisionId: null });
    await store.publish({
      key: "gallery",
      revisionId: draft.draftRevisionId!,
      expectedDraftRevisionId: draft.draftRevisionId,
      expectedPublishedRevisionId: null,
    });
    assert.ok(await readStudioMedia(sql, uploaded.id, directory));
    const next = await store.saveDraft({
      key: "gallery",
      content: { ...content, images: [] },
      expectedDraftRevisionId: draft.draftRevisionId,
    });
    await store.publish({
      key: "gallery",
      revisionId: next.draftRevisionId!,
      expectedDraftRevisionId: next.draftRevisionId,
      expectedPublishedRevisionId: draft.draftRevisionId,
    });
    assert.equal(await readStudioMedia(sql, uploaded.id, directory), null);
    assert.ok(
      await readStudioMedia(sql, uploaded.id, directory, true),
      "operator can still use an active original asset in a draft",
    );
  } finally {
    await context.close();
  }
});

test("another shop's images and invented static paths cannot be read, changed or published", async () => {
  const context = await setup();
  const { sql, directory } = context;
  try {
    const uploaded = await storeStudioImage(sql, await imageFile(), "operator-test", directory);
    await sql`update cms_media set shop_id='another-shop' where id=${uploaded.id}`;
    assert.equal(await readStudioMedia(sql, uploaded.id, directory, true), null);
    await assert.rejects(
      changeStudioMedia(sql, {
        id: uploaded.id,
        expectedVersion: 1,
        alt: "Fahrzeug",
        caption: "",
        approved: true,
      }),
      /nicht gefunden/,
    );
    await assert.rejects(
      validateCmsAssetsForPublication(sql, { images: [], heroAssetId: "static:condition-photos" }),
      /nicht in der freigegebenen/,
    );
    const catalog = await resolveCmsAssets(sql, { images: [], heroAssetId: "static:customer-01" });
    assert.equal(catalog[0].src, "/media/customer-photos/customer-01-1400.webp");
    assert.throws(
      () =>
        parseStudioMediaChange({
          id: uploaded.id,
          expectedVersion: 1,
          alt: " ",
          caption: "",
          approved: true,
        }),
      /Alt-Text/,
    );
  } finally {
    await context.close();
  }
});
