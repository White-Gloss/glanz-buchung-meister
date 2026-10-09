import assert from "node:assert/strict";
import { test } from "node:test";
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

test("the client entry starts only after eager hero images loaded, decoded and painted", async () => {
  const hero = new FakeImage(false);
  const page = fakePage({ images: [hero] });
  page.run(source);
  assert.equal(page.timers[0]?.delay, DEFERRED_BOOTSTRAP_FALLBACK_MS);

  await settle();
  assert.equal(page.inserted.length, 0, "nothing loads while the document is parsed");
  page.fire("DOMContentLoaded");
  assert.equal(page.selector(), 'img[fetchpriority="high"]:not([loading="lazy"])');
  await settle();
  assert.equal(page.frames.length, 0, "frames wait for the hero image");

  hero.emit("load");
  await settle();
  assert.ok(hero.decoded, "the hero image is decoded before it counts as painted");
  page.nextFrame();
  assert.equal(page.inserted.length, 0, "the first frame paints the hero image");
  page.nextFrame();
  assert.deepEqual(
    page.inserted.map(({ tag, rel, href, type, src }) => ({ tag, rel, href, type, src })),
    [
      { tag: "link", rel: "modulepreload", href: "/assets/routes-b.js", type: undefined, src: undefined },
      { tag: "script", rel: undefined, href: undefined, type: "module", src: "/assets/index-a.js" },
    ],
  );
  assert.equal(page.inserted[1]["@async"], "", "React finds the entry as an async script resource");

  page.timers[0].callback();
  assert.equal(page.inserted.length, 2, "the fallback never inserts a second entry");
});

test("a failed hero image or a parsed document does not hold hydration back", async () => {
  const broken = new FakeImage(false);
  const page = fakePage({ readyState: "interactive", images: [broken] });
  page.run(source);
  broken.emit("error");
  await settle();
  page.nextFrame();
  page.nextFrame();
  assert.equal(page.inserted.length, 2);
});

test("the fallback timer hydrates when frames never run", () => {
  const page = fakePage({ images: [new FakeImage(false)] });
  page.run(source);
  page.timers[0].callback();
  assert.equal(page.inserted.length, 2);
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
