import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the actual TSX callbacks, not copies of their implementation. The
// browser dependencies are isolated so these regressions need no live website,
// customer data, network requests, or extra test framework.
function sourceFile(name) {
  const path = new URL(`../src/components/${name}.tsx`, import.meta.url);
  return ts.createSourceFile(name + ".tsx", readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(source, predicate) {
  let found;
  function visit(node) {
    if (!found && predicate(node)) found = node;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, "Expected production callback or image renderer is present");
  return found;
}
function execute(node, source, scope = {}) {
  const code = ts.transpileModule(`const actual = ${node.getText(source)}; actual;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  return runInNewContext(code, scope);
}
function sliderCallback(name, scope) {
  const source = sourceFile("before-after-slider");
  const declaration = find(source, (node) => ts.isVariableDeclaration(node) && node.name.getText(source) === name);
  const callback = ts.isCallExpression(declaration.initializer)
    ? declaration.initializer.arguments[0]
    : declaration.initializer;
  return execute(callback, source, scope);
}
function hero({ ready = false, reduced = false, saveData = false, idle = true } = {}) {
  const source = sourceFile("media");
  const effect = find(source, (node) => ts.isCallExpression(node) && node.expression.getText(source) === "useEffect" && node.arguments[0]?.getText(source).includes("if (!imageReady) return;"));
  const document = Object.assign(new EventTarget(), { readyState: ready ? "complete" : "loading", hidden: false });
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const connection = Object.assign(new EventTarget(), { saveData });
  const window = new EventTarget();
  const pending = new Map();
  let nextId = 0;
  const schedule = (callback) => { pending.set(++nextId, callback); return nextId; };
  Object.assign(window, {
    matchMedia: (query) => query.includes("prefers-reduced-motion") ? motion : { matches: false },
    requestIdleCallback: idle ? schedule : undefined,
    cancelIdleCallback: (id) => pending.delete(id),
    setTimeout: schedule,
    clearTimeout: (id) => pending.delete(id),
  });
  const attributes = new Map();
  const downloads = [];
  let plays = 0;
  const video = {
    poster: "",
    getAttribute: (name) => attributes.get(name) ?? null,
    removeAttribute: (name) => attributes.delete(name),
    set src(value) { attributes.set("src", value); downloads.push(value); },
    play() { plays++; return Promise.resolve(); },
    pause() {},
    load() {},
  };
  let observer;
  const pausedRef = { current: false };
  const syncPlayback = { current() {} };
  const image = { currentSrc: "/media/hero-1080.avif" };
  const cleanup = execute(effect.arguments[0], source, {
    imageReady: true,
    containerRef: { current: { querySelector: () => image } },
    videoRef: { current: video },
    pausedRef,
    syncPlayback,
    setMotionAllowed() {},
    setPaused() {},
    document,
    window,
    navigator: { connection },
    pickHeroLoop: () => "/media/hero-loop.webm",
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observer = this; }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
  })();
  return {
    downloads, video, document, connection, motion, pausedRef, cleanup,
    get plays() { return plays; },
    visible(value = true) { if (!observer.disconnected) observer.callback([{ isIntersecting: value }]); },
    flush() { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach((callback) => callback()); },
    load() { document.readyState = "complete"; window.dispatchEvent(new Event("load")); },
  };
}

test("hero does not download decorative video while the page is still loading", () => {
  const h = hero();
  h.visible();
  h.flush();
  assert.equal(h.downloads.length, 0);
  h.load();
  h.flush();
  assert.equal(h.downloads.length, 1);
  h.cleanup();
});

test("hero reuses the already selected responsive image as the video poster", () => {
  const h = hero({ ready: true });
  h.visible();
  h.flush();
  assert.equal(h.video.poster, "/media/hero-1080.avif");
  assert.equal(h.plays, 1);
  h.cleanup();
});

test("hero supports browsers without requestIdleCallback without starting before load", () => {
  const h = hero({ idle: false });
  h.visible();
  h.flush();
  assert.equal(h.downloads.length, 0);
  h.load();
  h.flush();
  assert.equal(h.plays, 1);
  h.cleanup();
});

test("unmounting before page load cancels the pending media start", () => {
  const h = hero();
  h.visible();
  h.cleanup();
  h.load();
  h.flush();
  assert.equal(h.downloads.length, 0);
});

for (const options of [{ reduced: true }, { saveData: true }]) {
  test(`hero respects ${options.reduced ? "reduced motion" : "data saver"}`, () => {
    const h = hero({ ready: true, ...options });
    h.visible();
    h.flush();
    assert.equal(h.downloads.length, 0);
    h.cleanup();
  });
}

test("hero cancels a queued start when it leaves the viewport", () => {
  const h = hero({ ready: true });
  h.visible();
  h.visible(false);
  h.flush();
  assert.equal(h.downloads.length, 0);
  h.cleanup();
});

test("hero rechecks tab visibility before a queued start", () => {
  const h = hero({ ready: true });
  h.visible();
  h.document.hidden = true;
  h.flush();
  assert.equal(h.downloads.length, 0);
  h.cleanup();
});

for (const [key, expected] of [["ArrowLeft", 45], ["ArrowDown", 45], ["ArrowRight", 55], ["ArrowUp", 55], ["Home", 0], ["End", 100]]) {
  test(`comparison ${key} updates its value without scrolling the page`, () => {
    let position = 50;
    let prevented = false;
    const handle = sliderCallback("handleKeyDown", { setSliderPos(value) { position = typeof value === "function" ? value(position) : value; } });
    handle({ key, preventDefault() { prevented = true; } });
    assert.equal(position, expected);
    assert.equal(prevented, true);
  });
}

test("comparison keeps Tab available for normal keyboard navigation", () => {
  let position = 50;
  let prevented = false;
  const handle = sliderCallback("handleKeyDown", { setSliderPos(value) { position = typeof value === "function" ? value(position) : value; } });
  handle({ key: "Tab", preventDefault() { prevented = true; } });
  assert.equal(position, 50);
  assert.equal(prevented, false);
});

test("comparison never writes NaN for a zero-width container", () => {
  let position = 50;
  const update = sliderCallback("updatePosition", {
    containerRef: { current: { getBoundingClientRect: () => ({ left: 0, width: 0 }) } },
    setSliderPos(value) { position = value; },
  });
  update(20);
  assert.equal(position, 50);
});

test("comparison pointer movement remains clamped to its visible range", () => {
  let position = 50;
  const update = sliderCallback("updatePosition", {
    containerRef: { current: { getBoundingClientRect: () => ({ left: 20, width: 100 }) } },
    setSliderPos(value) { position = value; },
  });
  for (const [x, expected] of [[0, 0], [70, 50], [200, 100]]) {
    update(x);
    assert.equal(position, expected);
  }
});

function imageMarkup(src) {
  const source = sourceFile("before-after-slider");
  const renderer = find(source, (node) => ts.isFunctionDeclaration(node) && node.name?.text === "ComparisonImage");
  const React = { createElement(type, props, ...children) { return { type, props: props ?? {}, children }; } };
  const root = execute(renderer, source, { React })({ src, alt: "Test" });
  const elements = [];
  function walk(node) {
    if (node && typeof node === "object") {
      elements.push(node);
      node.children?.flat(Infinity).forEach(walk);
    }
  }
  walk(root);
  return elements;
}

test("comparison default photos expose AVIF/WebP sizes, dimensions and lazy loading", () => {
  for (const name of ["compare-before", "compare-after"]) {
    const elements = imageMarkup(`/media/${name}-800.webp`);
    const sources = elements.filter((element) => element.type === "source");
    assert.equal(sources.length, 2);
    for (const [index, format] of ["avif", "webp"].entries()) {
      assert.equal(sources[index].props.type, `image/${format}`);
      for (const width of [480, 800, 1200]) assert.ok(sources[index].props.srcSet.includes(`/media/${name}-${width}.${format} ${width}w`));
      assert.ok(sources[index].props.sizes);
    }
    const image = elements.find((element) => element.type === "img");
    assert.equal(image.props.width, 1200);
    assert.equal(image.props.height, 800);
    assert.equal(image.props.loading, "lazy");
    assert.equal(image.props.fetchPriority, "low");
  }
});

test("comparison custom URLs are not rewritten to nonexistent image variants", () => {
  const src = "/uploads/customer-comparison.webp";
  const elements = imageMarkup(src);
  assert.equal(elements.filter((element) => element.type === "source").length, 0);
  const image = elements.find((element) => element.type === "img");
  assert.equal(image.props.src, src);
  assert.equal(image.props.width, undefined);
  assert.equal(image.props.height, undefined);
});
