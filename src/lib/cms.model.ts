export type CmsDocumentKey = "home" | "about" | "gallery" | `service:${string}` | `city:${string}` | `faq:${string}` | `blog:${string}` | `legacy:${number}`;
export type CmsDocumentContent = {
  title: string;
  lead: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  sections: { id: string; title: string; body: string }[];
  faqs: { question: string; answer: string }[];
  images: { assetId: string; alt: string; caption: string }[];
  heroAssetId: string | null;
};

export function emptyCmsContent(): CmsDocumentContent {
  return { title: "", lead: "", body: "", metaTitle: "", metaDescription: "", sections: [], faqs: [], images: [], heroAssetId: null };
}

export function parseCmsDocumentKey(input: unknown, knownPageKeys: readonly string[]): CmsDocumentKey {
  if (typeof input !== "string" || input.length > 100 || !(
    ["home", "about", "gallery"].includes(input) ||
    knownPageKeys.includes(input) ||
    (/^(?:faq|blog):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input) && input.slice(input.indexOf(":") + 1).length <= 80) ||
    (/^legacy:[1-9]\d{0,9}$/.test(input) && Number(input.slice(7)) <= 2147483647)
  )) throw new Error("Ungültige Seitenkennung. Bitte eine vorhandene Seite wählen.");
  return input as CmsDocumentKey;
}

export function assertCmsRevision(actual: number | null, expected: number | null): void {
  if (actual !== expected) throw new Error("Der Inhalt wurde zwischenzeitlich geändert. Bitte neu laden und die Fassungen vergleichen.");
}

function object(input: unknown, allowed: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Ungültiger Inhalt.");
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw new Error(`Unbekanntes Feld: ${key}`);
  }
  return input as Record<string, unknown>;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max || value.includes("\u0000")) {
    throw new Error(`Text ist ungültig oder länger als ${max} Zeichen.`);
  }
  return value;
}

function entries(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Höchstens ${max} Einträge erlaubt.`);
  return value;
}

function asset(value: unknown): string {
  if (typeof value !== "string" || !/^(?:static:[a-z0-9][a-z0-9-]{0,79}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(value)) {
    throw new Error("Ungültige Bildreferenz. Bitte ein Bild aus der Mediathek wählen.");
  }
  return value;
}

/** Only editorial fields cross this seam. Render text as React text, never raw HTML. */
export function parseCmsContent(input: unknown): CmsDocumentContent {
  const row = object(input, Object.keys(emptyCmsContent()));
  const sectionIds = new Set<string>();
  const imageIds = new Set<string>();
  const content: CmsDocumentContent = {
    title: text(row.title, 200),
    lead: text(row.lead, 4000),
    body: text(row.body, 20000),
    metaTitle: text(row.metaTitle, 160),
    metaDescription: text(row.metaDescription, 320),
    sections: entries(row.sections, 24).map((value) => {
      const section = object(value, ["id", "title", "body"]);
      const id = text(section.id, 80);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || sectionIds.has(id)) throw new Error("Abschnitt benötigt eine eindeutige Kennung.");
      sectionIds.add(id);
      return { id, title: text(section.title, 200), body: text(section.body, 8000) };
    }),
    faqs: entries(row.faqs, 24).map((value) => {
      const faq = object(value, ["question", "answer"]);
      return { question: text(faq.question, 300), answer: text(faq.answer, 4000) };
    }),
    images: entries(row.images, 80).map((value) => {
      const image = object(value, ["assetId", "alt", "caption"]);
      const assetId = asset(image.assetId);
      if (imageIds.has(assetId)) throw new Error("Ein Bild darf nicht mehrfach in derselben Galerie stehen.");
      imageIds.add(assetId);
      return { assetId, alt: text(image.alt, 300), caption: text(image.caption, 500) };
    }),
    heroAssetId: row.heroAssetId === null ? null : asset(row.heroAssetId),
  };
  if (JSON.stringify(content).length > 100000) throw new Error("Der Inhalt ist zu umfangreich. Bitte auf mehrere Seiten verteilen.");
  return content;
}

