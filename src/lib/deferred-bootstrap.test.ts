import assert from "node:assert/strict";
import { test } from "node:test";
import * as bootstrap from "./deferred-bootstrap.ts";
import type { RouterManagedTag } from "@tanstack/router-core";
import {
  DEFERRED_BOOTSTRAP_FALLBACK_MS,
  deferredBootstrapSource,
  isModuleEntry,
  isModulePreload,
} from "./deferred-bootstrap.ts";

type Listener = () => void;

function fakePage({ readyState = "loading", images = [] as FakeImage[] } = {}) {
  const inserted: Record<string, string>[] = [];
  const documentListeners: Record<string, Listener[]> = {};
  const frames: Listener[] = [];
  const timers: { callback: Listener; delay: number }[] = [];
  let selector = "";
  const document = {
    readyState,
    head: { appendChild: (node: Record<string, string>) => inserted.push(node) },
    addEventListener: (type: string, listener: Listener) =>
      (documentListeners[type] ??= []).push(listener),
    removeEventListener: (type: string, listener: Listener) => {
      documentListeners[type] = (documentListeners[type] ??= []).filter((entry) => entry !== listener);
    },
    querySelectorAll: (query: string) => {
      selector = query;
      return images;
    },
    createElement: (tag: string) => {
      const node: Record<string, string> & { setAttribute?: (k: string, v: string) => void } = {
        tag,
      };
      node.setAttribute = (key, value) => {
        node[`@${key}`] = value;
      };
      return node;
    },
  };
  const window = {
    requestAnimationFrame: (callback: Listener) => frames.push(callback),
    setTimeout: (callback: Listener, delay: number) => timers.push({ callback, delay }),
  };
  return {
    run: (source: string) => new Function("document", "window", source)(document, window),
    inserted,
    frames,
    timers,
    selector: () => selector,
    listenerCount: (type: string) => documentListeners[type]?.length ?? 0,
    fire: (type: string) => documentListeners[type]?.forEach((listener) => listener()),
    nextFrame: () => frames.splice(0).forEach((callback) => callback()),
  };
}

class FakeImage {
  complete: boolean;
  decoded = false;
  private listeners: Record<string, Listener[]> = {};
  constructor(complete: boolean) {
    this.complete = complete;
  }
  addEventListener(type: string, listener: Listener) {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type: string) {
    this.complete = true;
    this.listeners[type]?.forEach((listener) => listener());
  }
  decode() {
    this.decoded = true;
    return Promise.resolve();
  }
}

const settle = () => new Promise((accept) => setTimeout(accept, 0));
const source = deferredBootstrapSource(["/assets/index-a.js"], ["/assets/routes-b.js"]);

test("image preloads precede competing font hints while metadata and stylesheet order stay intact", () => {
  assert.equal(typeof bootstrap.prioritizeImagePreloads, "function");
  const charset: RouterManagedTag = { tag: "meta", attrs: { charSet: "utf-8" } };
  const css: RouterManagedTag = { tag: "link", attrs: { rel: "stylesheet", href: "/first.css" } };
  const font: RouterManagedTag = { tag: "link", attrs: { rel: "preload", as: "font", href: "/font.woff2" } };
  const mobile: RouterManagedTag = { tag: "link", attrs: { rel: "preload", as: "image", href: "/mobile.webp", media: "(max-width: 767px)" } };
  const cssAfter: RouterManagedTag = { tag: "link", attrs: { rel: "stylesheet", href: "/second.css" } };
  const desktop: RouterManagedTag = { tag: "link", attrs: { rel: "preload", as: "image", href: "/desktop.webp", media: "(min-width: 768px)" } };
  const tags = [charset, css, font, mobile, cssAfter, desktop];
  const original = [...tags];
  assert.deepEqual(bootstrap.prioritizeImagePreloads(tags), [charset, css, mobile, desktop, font, cssAfter]);
  assert.deepEqual(tags, original);
});

test("the client entry starts only after eager hero images loaded, decoded and painted", async () => {
  const hero = new FakeImage(false);
  const page = fakePage({ images: [hero] });
  page.run(source);
  assert.equal(page.timers[0]?.delay, DEFERRED_BOOTSTRAP_FALLBACK_MS);
  assert.deepEqual(
    page.inserted.map(({ tag, rel, href, ...attributes }) => ({ tag, rel, href, priority: attributes["@fetchpriority"] })),
    [
      { tag: "link", rel: "modulepreload", href: "/assets/index-a.js", priority: "low" },
      { tag: "link", rel: "modulepreload", href: "/assets/routes-b.js", priority: "low" },
    ],
  );

  await settle();
  assert.equal(page.inserted.length, 2, "the entry does not execute while the document is parsed");
  page.fire("DOMContentLoaded");
  assert.equal(page.selector(), 'img[fetchpriority="high"]:not([loading="lazy"])');
  await settle();
  assert.equal(page.frames.length, 0, "frames wait for the hero image");

  hero.emit("load");
  await settle();
  assert.ok(hero.decoded, "the hero image is decoded before it counts as painted");
  page.nextFrame();
  assert.equal(page.inserted.length, 2, "the first frame paints the hero image");
  page.nextFrame();
  assert.deepEqual(
    page.inserted.map(({ tag, rel, href, type, src }) => ({ tag, rel, href, type, src })),
    [
      { tag: "link", rel: "modulepreload", href: "/assets/index-a.js", type: undefined, src: undefined },
      { tag: "link", rel: "modulepreload", href: "/assets/routes-b.js", type: undefined, src: undefined },
      { tag: "script", rel: undefined, href: undefined, type: "module", src: "/assets/index-a.js" },
    ],
  );
  assert.equal(page.inserted[2]["@async"], "", "React finds the entry as an async script resource");

  page.timers[0].callback();
  assert.equal(page.inserted.length, 3, "the fallback never inserts a second entry");
});

test("a failed hero image or a parsed document does not hold hydration back", async () => {
  const broken = new FakeImage(false);
  const page = fakePage({ readyState: "interactive", images: [broken] });
  page.run(source);
  broken.emit("error");
  await settle();
  page.nextFrame();
  page.nextFrame();
  assert.equal(page.inserted.length, 3);
});

test("the fallback timer hydrates when frames never run", () => {
  const page = fakePage({ images: [new FakeImage(false)] });
  page.run(source);
  page.timers[0].callback();
  assert.equal(page.inserted.length, 3);
});

test("overlapping entry and preload URLs are requested only once", () => {
  const page = fakePage();
  page.run(deferredBootstrapSource(["/assets/index-a.js"], ["/assets/index-a.js"]));
  assert.equal(page.inserted.length, 1);
  page.timers[0].callback();
  assert.equal(page.inserted.length, 2);
});

for (const intent of ["pointerdown", "keydown", "focusin"]) {
  test(`early ${intent} starts the client without waiting for the hero image`, async () => {
    const hero = new FakeImage(false);
    const page = fakePage({ readyState: "interactive", images: [hero] });
    page.run(source);

    page.fire(intent);
    assert.equal(page.inserted.length, 3, "Interaction intent should start the client immediately.");
    assert.equal(hero.decoded, false, "The unfinished image must not delay interaction readiness.");
    for (const event of ["pointerdown", "keydown", "focusin"]) {
      assert.equal(page.listenerCount(event), 0, "Release every intent listener once loading starts.");
      page.fire(event);
    }
    hero.emit("load");
    await settle();
    page.nextFrame();
    page.nextFrame();
    page.timers[0].callback();
    assert.equal(page.inserted.length, 3, "Image completion, later intent and fallback share one bootstrap.");
  });
}

test("normal image loading also removes the interaction listeners", async () => {
  const page = fakePage({ readyState: "interactive" });
  page.run(source);
  assert.equal(page.listenerCount("pointerdown"), 1);
  await settle();
  page.nextFrame();
  page.nextFrame();
  for (const intent of ["pointerdown", "keydown", "focusin"]) {
    assert.equal(page.listenerCount(intent), 0);
  }
});

test("asset lists cannot close the inline script", () => {
  const hostile = deferredBootstrapSource(["/assets/a.js</script><script>alert(1)//"], []);
  assert.doesNotMatch(hostile, /<\/script/i);
  assert.match(hostile, /\\u003c\/script>/);
});

test("only Start's module entry and module preloads are deferred", () => {
  assert.ok(isModuleEntry({ tag: "script", attrs: { type: "module", async: true, src: "/a.js" } }));
  assert.ok(!isModuleEntry({ tag: "script", attrs: { src: "/a.js" } }));
  assert.ok(!isModuleEntry({ tag: "script", attrs: { type: "module" }, children: "x()" }));
  assert.ok(isModulePreload({ tag: "link", attrs: { rel: "modulepreload", href: "/a.js" } }));
  assert.ok(!isModulePreload({ tag: "link", attrs: { rel: "preload", href: "/a.woff2" } }));
});
