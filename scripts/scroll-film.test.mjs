import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { scrollFilm } from "../src/data/scroll-film.ts";

// Execute the production effect with media/DOM event doubles. These tests do
// not substitute for browser rendering or actual decoder performance checks.
const source = ts.createSourceFile(
  "scroll-film-hero.tsx",
  readFileSync(new URL("../src/components/scroll-film-hero.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect")
    effect = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(effect);
const code = ts.transpileModule(`(${effect.getText(source)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({
  reduced = false,
  saveData = false,
  effectiveType = "4g",
  memory = 8,
  cores = 8,
  mobile = false,
  posterReady = true,
  hash = "",
} = {}) {
  const window = Object.assign(new EventTarget(), { scrollY: 0, location: { hash } });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const mobileMedia = Object.assign(new EventTarget(), { matches: mobile });
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const connection = Object.assign(new EventTarget(), { saveData, effectiveType });
  const pending = new Map();
  let id = 0;
  Object.assign(window, {
    matchMedia: (q) => (q.includes("prefers-reduced-motion") ? motion : mobileMedia),
    requestAnimationFrame: (fn) => {
      pending.set(++id, fn);
      return id;
    },
    cancelAnimationFrame: (i) => pending.delete(i),
  });
  const style = () => ({
    setProperty(name, value) {
      this[name] = value;
    },
  });
  const section = Object.assign(new EventTarget(), {
    dataset: {},
    style: style(),
    offsetHeight: 4600,
    getBoundingClientRect: () => ({ top: -window.scrollY }),
  });
  const stage = { offsetHeight: 1000 };
  const copy = { style: style(), inert: false };
  const poster = Object.assign(new EventTarget(), {
    complete: posterReady,
    currentSrc: "/poster.webp",
    src: "/poster.webp",
  });
  const seeks = [];
  const downloads = [];
  let time = 0;
  const video = Object.assign(new EventTarget(), {
    duration: 8,
    readyState: 0,
    seeking: false,
    dataset: {},
    pause() {},
    load() {},
    removeAttribute() {
      this.source = "";
    },
    cancelVideoFrameCallback() {},
  });
  Object.defineProperties(video, {
    currentTime: {
      get: () => time,
      set(value) {
        assert.equal(video.seeking, false, "seeks must not overlap");
        time = value;
        seeks.push(value);
        video.seeking = true;
      },
    },
    src: {
      get: () => video.source,
      set(value) {
        video.source = value;
        downloads.push(value);
      },
    },
  });
  const pausedRef = { current: false };
  let observer;
  const cleanup = runInNewContext(code, {
    window,
    document,
    navigator: { connection, deviceMemory: memory, hardwareConcurrency: cores },
    scrollFilm,
    sectionRef: { current: section },
    stageRef: { current: stage },
    imageRef: { current: poster },
    videoRef: { current: video },
    copyRef: { current: copy },
    pausedRef,
    setMotion() {},
    IntersectionObserver: class {
      constructor(fn) {
        observer = fn;
      }
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  })();
  observer([{ isIntersecting: true }]);
  const finishSeek = () => {
    if (video.seeking) {
      video.seeking = false;
      video.dispatchEvent(new Event("seeked"));
    }
  };
  const flush = () => {
    for (let n = 0; n < 100 && (pending.size || video.seeking); n++) {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((fn) => fn());
      finishSeek();
    }
  };
  return {
    video,
    seeks,
    downloads,
    window,
    document,
    motion,
    connection,
    section,
    copy,
    poster,
    pending,
    pausedRef,
    mobileMedia,
    cleanup,
    flush,
    finishSeek,
    load() {
      video.readyState = 2;
      video.dispatchEvent(new Event("loadeddata"));
      finishSeek();
      flush();
    },
    scroll(y) {
      window.scrollY = y;
      window.dispatchEvent(new Event("scroll"));
      flush();
    },
    visible(value) {
      observer([{ isIntersecting: value }]);
      flush();
    },
  };
}

test("poster is displayed before any video download; small screens choose the smaller file", () => {
  const h = harness({ posterReady: false, mobile: true });
  assert.equal(h.downloads.length, 0);
  h.poster.complete = true;
  h.poster.dispatchEvent(new Event("load"));
  assert.deepEqual(h.downloads, ["/media/scroll-film/classic-mobile-540.mp4"]);
  h.load();
  assert.equal(h.video.dataset.visible, "true");
  h.cleanup();
});
for (const options of [
  { reduced: true },
  { saveData: true },
  { effectiveType: "3g" },
  { memory: 2 },
  { cores: 2 },
  { hash: "#buchung" },
]) {
  test(`static fallback avoids all video traffic: ${JSON.stringify(options)}`, () => {
    const h = harness(options);
    h.scroll(1800);
    assert.equal(h.downloads.length, 0);
    assert.equal(h.section.dataset.motion, "still");
    h.cleanup();
  });
}
test("forward and reverse scroll reach matching times, with no overlapping seeks", () => {
  const h = harness();
  h.load();
  h.scroll(1800);
  assert.ok(Math.abs(h.video.currentTime - 3.979) < 0.03);
  assert.equal(h.copy.inert, true);
  h.scroll(720);
  assert.ok(Math.abs(h.video.currentTime - 1.592) < 0.03);
  h.scroll(0);
  assert.ok(h.video.currentTime < 0.03);
  assert.equal(h.copy.inert, false);
  h.scroll(6000);
  assert.ok(Math.abs(h.video.currentTime - 7.958) < 0.03);
  h.cleanup();
});
test("pause holds the decoded frame and resume seeks to the current scroll position", () => {
  const h = harness();
  h.load();
  h.scroll(720);
  const held = h.video.currentTime;
  h.pausedRef.current = true;
  h.scroll(2400);
  assert.equal(h.video.currentTime, held);
  h.pausedRef.current = false;
  h.section.dispatchEvent(new Event("film-resume"));
  h.flush();
  assert.ok(h.video.currentTime > 5.2);
  h.cleanup();
});
test("hidden and offscreen heroes do not continue decoding", () => {
  const h = harness();
  h.load();
  const previous = h.seeks.length;
  h.document.hidden = true;
  h.scroll(1000);
  assert.equal(h.seeks.length, previous);
  h.document.hidden = false;
  h.visible(false);
  h.scroll(1800);
  assert.equal(h.seeks.length, previous);
  h.visible(true);
  assert.ok(h.video.currentTime > 3.9);
  h.cleanup();
});
test("changing reduced-motion preference removes video and restores readable copy", () => {
  const h = harness();
  h.load();
  h.scroll(1600);
  h.motion.matches = true;
  h.motion.dispatchEvent(new Event("change"));
  assert.equal(h.section.dataset.motion, "still");
  assert.equal(h.video.source, "");
  assert.equal(h.copy.inert, false);
  assert.equal(h.copy.style.opacity, "1");
  h.cleanup();
});
test("media errors retain the poster and do not collapse an already entered sequence", () => {
  const h = harness();
  h.load();
  h.scroll(1600);
  h.video.dispatchEvent(new Event("error"));
  assert.equal(h.section.dataset.motion, "fallback");
  assert.equal(h.video.dataset.visible, undefined);
  h.cleanup();
});
test("unmount cancels pending work and detaches listeners", () => {
  const h = harness();
  h.load();
  h.window.scrollY = 1600;
  h.window.dispatchEvent(new Event("scroll"));
  h.cleanup();
  assert.equal(h.pending.size, 0);
  const count = h.seeks.length;
  h.scroll(2500);
  assert.equal(h.seeks.length, count);
});

test("crossing the mobile breakpoint changes the film while preserving scroll progress", () => {
  const h = harness();
  h.load();
  h.scroll(1800);
  h.mobileMedia.matches = true;
  h.mobileMedia.dispatchEvent(new Event("change"));
  assert.equal(h.downloads.at(-1), scrollFilm.mobileVideo);
  h.load();
  assert.ok(Math.abs(h.video.currentTime - 3.979) < 0.03);
  h.cleanup();
});
