import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyCmsContent } from "./cms.model.ts";
import {
  studioGalleryPhotos,
  studioHero,
  studioMetadata,
  type PublishedStudioDocument,
} from "./studio-public.ts";

const document = (): PublishedStudioDocument => ({
  content: emptyCmsContent(),
  revisionId: 4,
  assets: [],
});

test("published editorial metadata overrides text while blank fields retain established SEO", () => {
  const published = document();
  published.content.metaTitle = "  Pflege in Horb | White Gloss  ";
  const fallback = { title: "Bestehender Titel", description: "Bestehende Beschreibung" };
  assert.deepEqual(studioMetadata(published, fallback), {
    title: "Pflege in Horb | White Gloss",
    description: fallback.description,
  });
  assert.deepEqual(studioMetadata(null, fallback), fallback);
  assert.deepEqual(studioMetadata(undefined, fallback), fallback);
});

test("a hero uses only a resolved public asset and its editorial alt text", () => {
  const published = document();
  const id = "8f2ed420-e917-4bc2-966d-2fb22dc93a0e";
  published.content.heroAssetId = id;
  published.content.images = [
    { assetId: id, alt: "Geprüfter Lack im Werkstattlicht", caption: "Lackkontrolle" },
  ];
  assert.equal(
    studioHero(published),
    undefined,
    "A missing, archived or unapproved asset must not produce an image URL.",
  );
  published.assets = [
    {
      id,
      src: `/api/studio-media/${id}`,
      previewSrc: `/api/studio-media/${id}?preview=1`,
      width: 1600,
      height: 900,
      alt: "Alter Alternativtext",
      caption: "",
    },
  ];
  const hero = studioHero(published);
  assert.equal(hero?.alt, "Geprüfter Lack im Werkstattlicht");
  assert.equal(hero?.caption, "Lackkontrolle");
  assert.equal(hero?.src, `/api/studio-media/${id}`);
  assert.equal(studioHero(null), undefined);
});

test("gallery selection preserves editorial order and excludes unresolved assets", () => {
  const published = document();
  published.content.images = [
    { assetId: "second", alt: "Zweite Perspektive", caption: "Seitenansicht" },
    { assetId: "revoked", alt: "Privat", caption: "Nicht anzeigen" },
    { assetId: "first", alt: "Erste Perspektive", caption: "Frontansicht" },
  ];
  published.assets = ["first", "second"].map((id) => ({
    id,
    src: `/api/studio-media/${id}`,
    previewSrc: `/api/studio-media/${id}?preview=1`,
    width: 900,
    height: 1200,
    alt: "Alter Text",
    caption: "",
  }));
  const photos = studioGalleryPhotos(published);
  assert.deepEqual(
    photos?.map((photo) => [photo.id, photo.alt, photo.title]),
    [
      ["second", "Zweite Perspektive", "Seitenansicht"],
      ["first", "Erste Perspektive", "Frontansicht"],
    ],
  );
  assert.equal(
    photos?.some((photo) => photo.src.includes("preview=")),
    false,
  );
  assert.equal(
    studioGalleryPhotos(null),
    undefined,
    "No published document keeps the existing gallery.",
  );
  assert.deepEqual(
    studioGalleryPhotos(document()),
    [],
    "An explicitly published empty selection must not revive removed images.",
  );
});
