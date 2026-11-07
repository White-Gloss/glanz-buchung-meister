import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { site } from "../src/data/site.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { createElement } = require("react");
const { renderToString } = require("react-dom/server");
const routerApi = require("@tanstack/react-router");
const {
  createMemoryHistory, createRootRoute, createRoute, createRouter,
  HeadContent, Outlet, RouterProvider, notFound,
} = routerApi;

// Load the production root's head function. Other root imports concern the
// application shell and styles, which are not required for this router test.
const source = ts.createSourceFile(
  "__root.tsx",
  readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let headNode;
function findHead(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "createRootRoute") {
    headNode = node.arguments[0].properties.find((property) => property.name?.getText(source) === "head")?.initializer;
  }
  ts.forEachChild(node, findHead);
}
findHead(source);
assert.ok(headNode, "The production root must declare its head function");
const compiled = ts.transpileModule(`exports.head = ${headNode.getText(source)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
const exports = {};
new Function("site", "exports", compiled.outputText)(site, exports);

// Render the actual error component as well: React 19 hoists its metadata
// into the document head when TanStack skips the unsuccessful child head.
const notFoundSource = readFileSync(new URL("../src/components/not-found.tsx", import.meta.url), "utf8");
const notFoundCompiled = ts.transpileModule(notFoundSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
});
const notFoundExports = {};
new Function("require", "exports", notFoundCompiled.outputText)((specifier) => {
  if (specifier === "react/jsx-runtime") return require(specifier);
  if (specifier === "@tanstack/react-router") return routerApi;
  if (specifier === "@/components/ui") return { ctaPrimary: "primary", ctaGhost: "secondary" };
  if (specifier === "@/data/site") return { site };
  throw new Error(`Unexpected NotFound dependency: ${specifier}`);
}, notFoundExports);

async function renderPage(path, published) {
  let aboutHeadCalls = 0;
  const root = createRootRoute({
    head: exports.head,
    notFoundComponent: notFoundExports.NotFoundComponent,
    component: () => createElement("html", null,
      createElement("head", null, createElement(HeadContent)),
      createElement("body", null, createElement(Outlet))),
  });
  const about = createRoute({
    getParentRoute: () => root,
    path: "/ueber-uns",
    loader: async () => {
      if (!published) throw notFound();
      return { title: "Freigegebene Vorstellung" };
    },
    head: () => {
      aboutHeadCalls += 1;
      return { meta: [{ name: "robots", content: "index,follow,max-image-preview:large" }] };
    },
    component: () => createElement("h1", null, "Freigegebene Vorstellung"),
  });
  const router = createRouter({
    routeTree: root.addChildren([about]),
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: true,
  });
  await router.load();
  return {
    html: renderToString(createElement(RouterProvider, { router })),
    aboutHeadCalls,
  };
}

function robotsValues(html) {
  return [...html.matchAll(/<meta\b[^>]*name="robots"[^>]*>/g)]
    .map(([tag]) => tag.match(/content="([^"]*)"/)?.[1]);
}

test("an unpublished About renders its actual NotFound component and only noindex in the head", async () => {
  const page = await renderPage("/ueber-uns", false);
  assert.equal(page.aboutHeadCalls, 0, "The failed child head is skipped by TanStack");
  assert.match(page.html, /Seite nicht gefunden/);
  assert.doesNotMatch(page.html, /Freigegebene Vorstellung/);
  assert.deepEqual(robotsValues(page.html), ["noindex,nofollow"]);
  assert.deepEqual(robotsValues(page.html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ""), ["noindex,nofollow"]);
});

test("an unknown URL also renders NotFound with a single noindex directive", async () => {
  const page = await renderPage("/nicht-vorhanden", false);
  assert.match(page.html, /Seite nicht gefunden/);
  assert.deepEqual(robotsValues(page.html), ["noindex,nofollow"]);
});

test("a published About remains indexable without a conflicting root noindex", async () => {
  const page = await renderPage("/ueber-uns", true);
  assert.equal(page.aboutHeadCalls, 1);
  assert.match(page.html, /Freigegebene Vorstellung/);
  assert.deepEqual(robotsValues(page.html), ["index,follow,max-image-preview:large"]);
});
