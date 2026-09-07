import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { resolveParentEmbedderOrigin } from "../src/lib/preview-embedder-origin.ts";

// Execute the component's real effect with controlled module loading, without a DOM dependency.
const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/components/preview-host-bridge.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
);

function mount({
  framed = true,
  referrer = "https://grok.com/",
  ancestorOrigins = [],
  hostname = "white-gloss.de",
} = {}) {
  let effect;
  let resolveModule;
  let rejectModule;
  let imports = 0;
  let installs = 0;
  let disposals = 0;
  let options;
  const warnings = [];
  const navigations = [];
  const routeTree = { path: "/" };
  const deferredModule = new Promise((resolve, reject) => {
    resolveModule = resolve;
    rejectModule = reject;
  });
  const window = { location: { ancestorOrigins, hostname } };
  window.parent = framed ? {} : window;
  const exports = {};
  runInNewContext(outputText, {
    exports,
    window,
    document: { referrer },
    console: { warn: (...args) => warnings.push(args) },
    require(id) {
      if (id === "react") return { useEffect: (callback) => { effect = callback; } };
      if (id === "@tanstack/react-router") {
        return { useRouter: () => ({ history: { push: (path) => navigations.push(path) }, routeTree }) };
      }
      if (id === "@/lib/preview-embedder-origin") return { resolveParentEmbedderOrigin };
      if (id === "@/lib/preview-host-bridge") {
        imports++;
        return deferredModule;
      }
      throw new Error(`Unexpected module: ${id}`);
    },
  });
  assert.equal(exports.PreviewHostBridge(), null);
  const cleanup = effect();
  return {
    cleanup,
    warnings,
    navigations,
    get imports() { return imports; },
    get installs() { return installs; },
    get disposals() { return disposals; },
    get options() { return options; },
    resolve() {
      resolveModule({
        collectRoutePathsFromTree(tree) {
          assert.equal(tree, routeTree);
          return ["/", "/preise"];
        },
        installPreviewHostBridge(bridgeOptions) {
          installs++;
          options = bridgeOptions;
          return () => { disposals++; };
        },
      });
    },
    reject() { rejectModule(new Error("Module request failed")); },
  };
}

describe("PreviewHostBridge deferred lifecycle", () => {
  it("does not request the bridge during a normal top-level visit", async () => {
    const bridge = mount({ framed: false });
    await setImmediate();
    assert.equal(bridge.imports, 0);
    assert.equal(bridge.cleanup, undefined);
  });

  it("does not request the bridge for a disallowed parent", async () => {
    const bridge = mount({ referrer: "https://untrusted.example/" });
    await setImmediate();
    assert.equal(bridge.imports, 0);
  });

  it("retains the allowed preview's navigation, route listing and cleanup", async () => {
    const bridge = mount();
    bridge.resolve();
    await setImmediate();
    assert.equal(bridge.imports, 1);
    assert.equal(bridge.installs, 1);
    bridge.options.navigate("/preise");
    assert.deepEqual(bridge.navigations, ["/preise"]);
    assert.deepEqual(bridge.options.getRoutePaths(), ["/", "/preise"]);
    bridge.cleanup();
    assert.equal(bridge.disposals, 1);
  });

  it("retains the existing ancestor-origin fallback when referrer is absent", async () => {
    const bridge = mount({ referrer: "", ancestorOrigins: ["https://grok.com"] });
    bridge.resolve();
    await setImmediate();
    assert.equal(bridge.installs, 1);
    bridge.cleanup();
  });

  it("does not install listeners or patch history after unmount during loading", async () => {
    const bridge = mount();
    bridge.cleanup();
    bridge.resolve();
    await setImmediate();
    assert.equal(bridge.installs, 0);
    assert.equal(bridge.disposals, 0);
  });

  it("handles a failed module request without an unhandled rejection", async () => {
    const bridge = mount();
    bridge.reject();
    await setImmediate();
    assert.equal(bridge.installs, 0);
    assert.equal(bridge.warnings.length, 1);
    bridge.cleanup();
  });

  it("does not report a module failure after unmount", async () => {
    const bridge = mount();
    bridge.cleanup();
    bridge.reject();
    await setImmediate();
    assert.equal(bridge.warnings.length, 0);
  });
});
