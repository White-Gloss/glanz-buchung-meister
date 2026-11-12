import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDict, PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { documentFontData } from "../src/lib/document-font-data.generated.ts";
import { documentGraphemes, documentText, documentTextRenderer, embedDocumentFonts } from "../src/lib/document-fonts.ts";
import { createBookingRequestPdf } from "../src/lib/booking-pdf.ts";
import { createBusinessDocumentPdf } from "../src/lib/document-pdf.ts";
import { documentLogoBase64 } from "../src/lib/document-logo.generated.ts";
import { HeroTitle } from "../src/components/hero-title.ts";

const fontDirectory = new URL("../public/fonts/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("font-source-manifest.json", fontDirectory), "utf8"));

test("hero compounds keep their original wording and gain only controlled optional breaks", () => {
  for (const [original, expected] of [
    ["Ratgeber Fahrzeugpflege.", "Ratgeber Fahr\u00adzeug\u00adpflege."],
    ["Fahrzeugaufbereitung für Nagold", "Fahr\u00adzeug\u00adauf\u00adbereitung für Nagold"],
    ["Keramikversiegelung & Langzeitschutz in Horb", "Keramik\u00adver\u00adsiegelung & Langzeit\u00adschutz in Horb"],
  ]) {
    const title = HeroTitle({ children: original });
    assert.equal(title.props.children, expected);
    assert.equal(title.props.children.replaceAll("\u00ad", ""), original);
    assert.equal(title.props["aria-hidden"], true, "The parent heading exposes the unmodified accessible title");
    assert.equal(HeroTitle({ children: expected }), expected, "Optional breaks are not duplicated");
  }
});

test("hero formatting leaves all other words, customer names and larger compounds unchanged", () => {
  for (const original of ["", "Müller · Şahin · Иванов", "Fahrzeugpflegeprodukte", "Langzeitschutzwirkung", "Keramikversiegelungslack", "Vorfahrzeugaufbereitung", "Fahrzeugpflegeöl"]) {
    assert.equal(HeroTitle({ children: original }), original);
  }
});

test("unformatted CMS titles retain the real SSR text node required by the sitemap publication check", () => {
  const title = "QA Sitemap Test";
  const html = renderToStaticMarkup(createElement("h1", { "aria-label": title }, createElement(HeroTitle, { children: title })));
  assert.match(html, /<h1[^>]*>QA Sitemap Test<\/h1>/);
});

test("local web fonts match their licensed sources and cover German text without another subset", async () => {
  for (const family of ["syne", "plus-jakarta-sans"]) {
    const filename = `${family}-latin-variable.woff2`;
    const bytes = await readFile(new URL(filename, fontDirectory));
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.files[filename].sha256);
    const font = fontkit.create(bytes);
    for (const character of "Fahrzeugaufbereitung ÄÖÜäöüß 1.249,00 € – „Glanz“") {
      assert.ok(font.hasGlyphForCodePoint(character.codePointAt(0)), `${filename}: ${character}`);
    }
    assert.ok(font.variationAxes.wght.min <= 400 && font.variationAxes.wght.max >= 800);
    const extendedFile = `${family}-latin-ext-variable.woff2`;
    const extendedBytes = await readFile(new URL(extendedFile, fontDirectory));
    assert.equal(createHash("sha256").update(extendedBytes).digest("hex"), manifest.files[extendedFile].sha256);
    const extended = fontkit.create(extendedBytes);
    // Fontkit lists a synthetic U+FFFF .notdef entry; it is not an encoded glyph.
    const characters = (face) => face.characterSet.filter((code) => face.hasGlyphForCodePoint(code));
    assert.equal(characters(font).filter((code) => characters(extended).includes(code)).length, 0, "subsets must not fetch the same Unicode characters twice");
    const fullFont = fontkit.create(gunzipSync(Buffer.from(documentFontData[family === "syne" ? "heading" : "body"], "base64")));
    assert.deepEqual([...characters(font), ...characters(extended)].sort((a, b) => a - b), characters(fullFont).sort((a, b) => a - b), "extended customer names retain the complete original glyph coverage");
    assert.match(await readFile(new URL(`${family}-OFL.txt`, fontDirectory), "utf8"), /SIL OPEN FONT LICENSE Version 1\.1/);
  }
  assert.doesNotMatch((await readdir(fontDirectory)).join("\n"), /barlow|cormorant|geist/i);
});

test("print fonts preserve their static weights and Unicode text independently of HTTP", async () => {
  const files = {
    body: ["plus-jakarta-sans-400.ttf", "PlusJakartaSans-Regular"],
    bodyStrong: ["plus-jakarta-sans-500.ttf", "PlusJakartaSans-Medium"],
    heading: ["syne-700.ttf", "Syne-Bold"],
    numbers: ["syne-800.ttf", "Syne-ExtraBold"],
    fallback: ["NotoSans-fallback.ttf", "NotoSans-Regular"],
  };
  for (const [role, [filename, name]] of Object.entries(files)) {
    const bytes = gunzipSync(Buffer.from(documentFontData[role], "base64"));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.files[filename].sha256);
    const font = fontkit.create(bytes);
    assert.equal(font.postscriptName, name);
    assert.deepEqual(Object.keys(font.variationAxes), [], "PDFs embed static instances");
  }
  const doc = await PDFDocument.create();
  const fonts = await embedDocumentFonts(doc);
  assert.equal(documentText("Mu\u0308ller Şahin Nguyễn 49,00 € 🚗", fonts.body, fonts.fallback), "Müller Şahin Nguyễn 49,00 € ?");
  for (const font of Object.values(fonts)) {
    assert.equal(documentText("ÄÖÜäöüß 1.249,00 € –", font, fonts.fallback), "ÄÖÜäöüß 1.249,00 € –");
    assert.ok(font.widthOfTextAtSize("1.249,00 €", 10) > 0);
    assert.equal(documentText("Γεώργιος Иванов и\u0301 Nguyễn", font, fonts.fallback), "Γεώργιος Иванов и\u0301 Nguyễn");
    assert.equal(documentText("🚗 中文", font, fonts.fallback), "? ??", "previously unrenderable text keeps the existing question-mark behavior");
  }
  const previous = await doc.embedFont(StandardFonts.Helvetica);
  for (const code of previous.getCharacterSet()) {
    const character = String.fromCodePoint(code);
    for (const font of Object.values(fonts)) {
      assert.equal(documentText(character, font, fonts.fallback), character.normalize("NFC"), `previously supported U+${code.toString(16)} remains intact`);
    }
  }
  assert.notEqual(fonts.heading.widthOfTextAtSize("White-Gloss", 20), fonts.numbers.widthOfTextAtSize("White-Gloss", 20));
});

test("PDF fallback keeps combining marks with their base and measures the exact drawn runs", async () => {
  const fonts = await embedDocumentFonts(await PDFDocument.create());
  const renderer = documentTextRenderer(fonts);
  const value = "Aи\u0301Z";
  assert.deepEqual(documentGraphemes(value), ["A", "и\u0301", "Z"]);
  const drawn = [];
  renderer.drawText({ drawText: (text, options) => drawn.push({ text, ...options }) }, value, { x: 17, y: 20, size: 12, font: fonts.body });
  assert.deepEqual(drawn.map(({ text, font }) => ({ text, font })), [
    { text: "A", font: fonts.body },
    { text: "и\u0301", font: fonts.fallback },
    { text: "Z", font: fonts.body },
  ]);
  let edge = 17;
  for (const run of drawn) {
    assert.equal(run.x, edge);
    edge += run.font.widthOfTextAtSize(run.text, run.size);
  }
  assert.ok(Math.abs(renderer.widthOfTextAtSize(value, 12) - (edge - 17)) < 0.000001);
});

function embeddedFontNames(doc) {
  return doc.context.enumerateIndirectObjects()
    .flatMap(([, object]) => object instanceof PDFDict ? [object.get(PDFName.of("BaseFont"))?.toString() || ""] : [])
    .join("\n");
}

test("new request and multipage business PDFs embed the brand fonts and keep their document identities", async () => {
  const request = await createBookingRequestPdf({
    id: 999999,
    customer_name: "Testperson Müller Şahin Иванов и\u0301",
    phone: "+490000000000",
    email: "typografie@example.invalid",
    package_id: "premium",
    class_id: "suv",
    extra_ids: "[]",
    total_cents: 42900,
    note: "Nur ein Offline-Test. Keine Buchung und kein Versand.",
  });
  const requestDoc = await PDFDocument.load(Buffer.from(request, "base64"));
  assert.equal(requestDoc.getTitle(), "Buchungsanfrage WG-999999");
  assert.equal(requestDoc.getPageCount(), 1);
  const business = await createBusinessDocumentPdf({
    title: "Typografie-Test",
    reference: "OFFLINE-999999",
    logo: documentLogoBase64,
    company: "White-Gloss",
    address: "Offline-Test",
    email: "typografie@example.invalid",
    customer: ["Testperson Müller Şahin Nguyễn", "Γεώργιος Иванов и\u0301"],
    metadata: ["Keine echte Buchung"],
    introduction: "Offline-Prüfung mit längeren Tabellenzeilen und Umlauten.",
    vehicle: "Testfahrzeug",
    rows: Array.from({ length: 36 }, (_, i) => ({
      name: `Prüfposition ${i + 1}: Innenraumreinigung und sorgfältige Fahrzeugaufbereitung mit zusätzlichen Erläuterungen.`,
      quantity: 1,
      grossCents: 11900,
      taxRate: 19,
    })),
    amountCents: 36 * 11900,
    details: ["Dieser Test erzeugt nur ein Dokument im Speicher."],
    footerRight: ["Keine Rechnung oder Zahlungsaufforderung."],
  });
  const businessDoc = await PDFDocument.load(Buffer.from(business, "base64"));
  assert.equal(businessDoc.getTitle(), "Typografie-Test OFFLINE-999999");
  assert.ok(businessDoc.getPageCount() >= 2, "long tables must continue on further pages");
  for (const doc of [requestDoc, businessDoc]) {
    const names = embeddedFontNames(doc);
    assert.match(names, /Syne-ExtraBold/);
    assert.match(names, /Syne-Bold/);
    assert.match(names, /PlusJakartaSans-Regular/);
    assert.match(names, /PlusJakartaSans-Medium/);
    assert.match(names, /NotoSans-Regular/);
    assert.doesNotMatch(names, /Helvetica|Arial|Barlow|Geist|Cormorant/i);
  }
});
