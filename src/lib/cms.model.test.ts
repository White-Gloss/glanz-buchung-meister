import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCmsRevision, emptyCmsContent, parseCmsContent, parseCmsDocumentKey } from "./cms.model.ts";

test("Studio content cannot introduce a price or unknown executable field", () => {
  const content = { ...emptyCmsContent(), title: "Unsere Arbeit" };
  assert.throws(() => parseCmsContent({ ...content, price: 1 }), /Unbekanntes Feld/);
  assert.throws(() => parseCmsContent({ ...content, script: "alert(1)" }), /Unbekanntes Feld/);
  assert.deepEqual(parseCmsContent(content), content);
});

test("Studio rejects unbounded content, arbitrary image URLs and duplicate section IDs", () => {
  const content = { ...emptyCmsContent(), title: "Unsere Arbeit" };
  assert.throws(() => parseCmsContent({ ...content, body: "a".repeat(20001) }), /Text/);
  assert.throws(() => parseCmsContent({ ...content, heroAssetId: "https://private.example/photo" }), /Bild/);
  assert.throws(() => parseCmsContent({ ...content, images: [{ assetId: "static:customer-01", alt: "Bild", caption: "", price: 1 }] }), /Unbekanntes Feld/);
  assert.throws(() => parseCmsContent({ ...content, sections: [{ id: "one", title: "Eins", body: "" }, { id: "one", title: "Zwei", body: "" }] }), /Abschnitt/);
});

test("Editorial text stays plain text and asset references remain separate from URLs", () => {
  const content = { ...emptyCmsContent(), title: "<script>alert(1)</script>", images: [{ assetId: "static:customer-01", alt: "Schwarzer BMW", caption: "Lackfinish" }] };
  assert.equal(parseCmsContent(content).title, content.title, "Rendering must escape text; validation must not silently rewrite it");
  assert.deepEqual(parseCmsContent(content).images, content.images);
});

test("Only existing service and city routes can become Studio documents", () => {
  const keys = ["service:lackkorrektur", "city:horb-am-neckar"];
  assert.equal(parseCmsDocumentKey("service:lackkorrektur", keys), "service:lackkorrektur");
  assert.equal(parseCmsDocumentKey("faq:pflege-nach-dem-termin", keys), "faq:pflege-nach-dem-termin");
  assert.throws(() => parseCmsDocumentKey("service:erfunden", keys), /Seitenkennung/);
  assert.throws(() => parseCmsDocumentKey("city:neuer-betriebsstandort", keys), /Seitenkennung/);
  assert.throws(() => parseCmsDocumentKey("legacy:-1", keys), /Seitenkennung/);
});

test("A stale editor cannot overwrite a newer draft or publication", () => {
  assert.doesNotThrow(() => assertCmsRevision(null, null));
  assert.doesNotThrow(() => assertCmsRevision(4, 4));
  assert.throws(() => assertCmsRevision(5, 4), /zwischenzeitlich/);
  assert.throws(() => assertCmsRevision(5, null), /zwischenzeitlich/);
});

test("Existing blog short texts fit Studio revisions without truncation", () => {
  const content = { ...emptyCmsContent(), lead: "a".repeat(3989) };
  assert.equal(parseCmsContent(content).lead, content.lead);
  assert.throws(() => parseCmsContent({ ...content, lead: "a".repeat(4001) }), /Text/);
});

test("Document identifiers fit the database and each gallery image appears only once", () => {
  assert.throws(() => parseCmsDocumentKey("legacy:2147483648", []), /Seitenkennung/);
  assert.throws(() => parseCmsDocumentKey(`faq:${"a".repeat(81)}`, []), /Seitenkennung/);
  const image = { assetId: "static:customer-01", alt: "Lackfinish", caption: "" };
  assert.throws(() => parseCmsContent({ ...emptyCmsContent(), images: [image, image] }), /mehrfach/);
});

