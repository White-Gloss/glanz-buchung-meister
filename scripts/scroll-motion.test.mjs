import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Exercise the production hook effect without a website server or GSAP DOM.
const source = ts.createSourceFile(
  "scroll-motion.ts",
  readFileSync(new URL("../src/lib/scroll-motion.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
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
const settle = () => new Promise((resolve) => setImmediate(resolve));

function harness({ matches = true, viewport = "selector", present = true, fail = false } = {}) {
  const media = Object.assign(new EventTarget(), { matches });
  const target = present ? {} : null;
  const scope = { current: {} };
  const counts = { loads: 0, contexts: 0, setups: 0, reverts: 0, disconnects: 0 };
  let observed;
  let notify;
  let resolve;
  let reject;
  const pending = new Promise((done, error) => {
    resolve = done;
    reject = error;
  });
  const loaded = {
    gsap: {
      matchMedia(actualScope) {
        assert.equal(actualScope, scope.current);
        counts.contexts++;
        let cleanup;
        return {
          add(actualQuery, setup) {
            assert.equal(actualQuery, "desktop-motion");
            cleanup = setup();
          },
          revert() {
            counts.reverts++;
            cleanup?.();
          },
        };
      },
    },
    ScrollTrigger: {},
  };
  const viewportArgument =
    viewport === "selector" ? ".workshop-personal" : viewport === "ref" ? { current: target } : undefined;
  const cleanup = runInNewContext(code, {
    query: "desktop-motion",
    viewport: viewportArgument,
    scope,
    setupRef: {
      current(tools) {
        assert.equal(tools, loaded);
        counts.setups++;
        return () => counts.setups--;
      },
    },
    window: { matchMedia: () => media },
    document: {
      querySelector(selector) {
        assert.equal(selector, ".workshop-personal");
        return target;
      },
    },
    loadScrollMotion() {
      counts.loads++;
      return fail ? Promise.reject(new Error("offline")) : pending;
    },
    IntersectionObserver: class {
      constructor(callback, options) {
        notify = callback;
        assert.equal(options.rootMargin, "320px 0px");
      }
      observe(element) {
        observed = element;
      }
      disconnect() {
        counts.disconnects++;
      }
    },
  })();
  return {
    counts,
    cleanup,
    observed,
    target,
    resolve: () => resolve(loaded),
    reject: () => reject(new Error("offline")),
    near(value = true) {
      notify?.([{ isIntersecting: value }]);
    },
    media(value) {
      media.matches = value;
      media.dispatchEvent(new Event("change"));
    },
  };
}

test("below-the-fold motion waits for its actual viewport target", async () => {
  const h = harness();
  assert.equal(h.observed, h.target);
  assert.equal(h.counts.loads, 0);
  h.near(false);
  assert.equal(h.counts.loads, 0);
  h.near();
  assert.equal(h.counts.loads, 1);
  h.resolve();
  await settle();
  assert.equal(h.counts.setups, 1);
  h.cleanup();
  assert.equal(h.counts.setups, 0);
  assert.equal(h.counts.reverts, 1);
});

test("phone and reduced-motion queries never load tools before they match", async () => {
  const h = harness({ matches: false, viewport: "ref" });
  h.near();
  assert.equal(h.counts.loads, 0);
  h.media(true);
  assert.equal(h.counts.loads, 1);
  h.resolve();
  await settle();
  h.cleanup();
});

test("a media match alone does not download an unseen section", () => {
  const h = harness({ matches: false });
  h.media(true);
  assert.equal(h.counts.loads, 0);
  h.cleanup();
  h.near();
  h.media(true);
  assert.equal(h.counts.loads, 0);
  assert.ok(h.counts.disconnects > 0);
});

test("unmount while the tools download prevents late animation setup", async () => {
  const h = harness();
  h.near();
  h.cleanup();
  h.resolve();
  await settle();
  assert.equal(h.counts.contexts, 0);
});

test("an unavailable viewport target never downloads animation tools", () => {
  const h = harness({ present: false });
  assert.equal(h.counts.loads, 0);
  assert.equal(h.cleanup, undefined);
});

test("existing callers without viewport gating still start immediately", async () => {
  const immediate = harness({ viewport: "none" });
  assert.equal(immediate.counts.loads, 1);
  immediate.resolve();
  await settle();
  immediate.cleanup();
  assert.equal(immediate.counts.reverts, 1);
});

test("failed tool downloads leave the page static and clean up listeners", async () => {
  const h = harness({ fail: true });
  h.near();
  await settle();
  assert.equal(h.counts.contexts, 0);
  h.cleanup();
  h.media(true);
  assert.equal(h.counts.loads, 1);
});
