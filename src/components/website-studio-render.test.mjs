import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

// Exercise the production renderer without a development server. Type-only
// imports disappear; the JSX transform is the same React automatic runtime.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const source = readFileSync(new URL("./website-studio-content.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
});
/** @type {{ exports: Partial<typeof import("./website-studio-content.tsx")> }} */
const module = { exports: {} };
new Function("require", "exports", "module", compiled.outputText)(require, module.exports, module);
const { WebsiteStudioContent } = module.exports;
if (typeof WebsiteStudioContent !== "function") {
  throw new Error("The production renderer did not export WebsiteStudioContent.");
}
const fieldsSource = readFileSync(new URL("./website-studio-fields.tsx", import.meta.url), "utf8");
const compiledFields = ts.transpileModule(fieldsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
});
const fieldsModule = { exports: {} };
const fieldsRequire = (name) => {
  if (name === "./ui") return { Button: (props) => createElement("button", props), inputClass: "field" };
  // Ordering callbacks are not invoked while rendering an empty simple editor.
  if (name === "./website-studio-state") return {};
  return require(name);
};
new Function("require", "exports", "module", compiledFields.outputText)(fieldsRequire, fieldsModule.exports, fieldsModule);
const { WebsiteStudioFields } = fieldsModule.exports;
const content = {
  title: "Redaktion",
  lead: "Einleitung",
  body: '<script>alert("privat")</script>',
  metaTitle: "",
  metaDescription: "",
  sections: [],
  faqs: [],
  images: [{ assetId: "asset-1", alt: "Lackaufnahme", caption: "Geprüft" }],
  heroAssetId: "asset-1",
};
const assets = [
  {
    id: "asset-1",
    src: "/api/studio-media/asset-1",
    previewSrc: "/api/studio-media/asset-1?preview=1",
    alt: "Lackaufnahme",
    caption: "Geprüft",
    width: 1200,
    height: 800,
  },
];

test("the simple blog editor exposes its existing short text and keeps FAQ forms unchanged", () => {
  const props = { content: { ...content, lead: "Pflegehinweise vor dem Winter." }, assets: [], simple: true, edit() {}, openMedia() {} };
  const blog = renderToStaticMarkup(createElement(WebsiteStudioFields, { ...props, leadLabel: "Kurztext" }));
  assert.match(blog, /Kurztext<\/label>/);
  assert.match(blog, /maxlength="4000"/i);
  assert.match(blog, /<textarea[^>]*>Pflegehinweise vor dem Winter\.<\/textarea>/);
  const faq = renderToStaticMarkup(createElement(WebsiteStudioFields, props));
  assert.doesNotMatch(faq, /Kurztext|Pflegehinweise vor dem Winter/);
});

test("public rendering escapes editorial HTML and never selects the private preview URL", () => {
  const html = renderToStaticMarkup(createElement(WebsiteStudioContent, { content, assets }));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|preview=1/);
  assert.equal((html.match(/<img /g) ?? []).length, 1);
  assert.match(html, /width="1200" height="800"/);
});

test("protected preview selects authenticated image URLs and keeps a single supplied heading", () => {
  const html = renderToStaticMarkup(
    createElement(WebsiteStudioContent, { content, assets, preview: true, headingLevel: 1 }),
  );
  assert.match(html, /preview=1/);
  assert.equal((html.match(/<h1 /g) ?? []).length, 1);
});

test("public integration can omit existing intro, body and gallery without dropping editorial sections", () => {
  const html = renderToStaticMarkup(
    createElement(WebsiteStudioContent, {
      content: {
        ...content,
        sections: [{ id: "work", title: "Arbeitsweise", body: "Individuell geprüft." }],
      },
      assets,
      showIntro: false,
      showBody: false,
      showHero: false,
      showImages: false,
    }),
  );
  assert.doesNotMatch(html, /Redaktion|Einleitung|&lt;script&gt;|<img /);
  assert.match(html, /Arbeitsweise/);
  assert.match(html, /Individuell geprüft/);
});

test("unresolved media is not exposed as a broken public image", () => {
  const html = renderToStaticMarkup(createElement(WebsiteStudioContent, { content, assets: [] }));
  assert.doesNotMatch(html, /<img /);
});

test("embedding below a page hero adds H2 sections and questions without another H1", () => {
  const html = renderToStaticMarkup(
    createElement(WebsiteStudioContent, {
      content: {
        ...content,
        sections: [{ id: "work", title: "Arbeitsweise", body: "Sorgfältig geprüft." }],
        faqs: [{ question: "Wo arbeiten wir?", answer: "In Horb am Neckar." }],
      },
      assets,
      headingLevel: 1,
      showIntro: false,
      showHero: false,
    }),
  );
  assert.doesNotMatch(html, /<h1(?:\s|>)/);
  assert.equal((html.match(/<h2(?:\s|>)/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<h3(?:\s|>)/);
});

