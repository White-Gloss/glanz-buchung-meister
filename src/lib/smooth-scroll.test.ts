import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { connectScrollTrigger, controlSmoothScroll, type SmoothScrollEnv } from "./smooth-scroll.ts";

const settle = () => new Promise((resolve) => setImmediate(resolve));

function harness({ matches = true, locked = false, fail = false } = {}) {
  const media = Object.assign(new EventTarget(), { matches });
  const calls: string[] = [];
  const subscriptions: Array<() => void> = [];
  let lock = locked;
  let onLock = () => {};
  let created = 0;
  const env: SmoothScrollEnv = {
    media: media as unknown as SmoothScrollEnv["media"],
    create: () => {
      created++;
      if (fail) return Promise.reject(new Error("offline"));
      return Promise.resolve({
        start: () => calls.push("start"),
        stop: () => calls.push("stop"),
        destroy: () => calls.push("destroy"),
        on: (_event: "scroll", callback: () => void) => {
          subscriptions.push(callback);
          return () => calls.push("unsubscribe");
        },
      } as never);
    },
    isLocked: () => lock,
    observeLock: (callback) => {
      onLock = callback;
      return () => calls.push("unobserve");
    },
  };
  return {
    env,
    calls,
    subscriptions,
    created: () => created,
    setMedia(value: boolean) {
      media.matches = value;
      media.dispatchEvent(new Event("change"));
    },
    setLock(value: boolean) {
      lock = value;
      onLock();
    },
  };
}

describe("Lenis-Steuerung", () => {
  it("lädt Lenis nicht für Touch-Geräte oder reduzierte Bewegung", async () => {
    const h = harness({ matches: false });
    const dispose = controlSmoothScroll(h.env);
    await settle();
    assert.equal(h.created(), 0);
    dispose();
    assert.deepEqual(h.calls, ["unobserve"]);
  });

  it("hält Lenis an, solange Menü oder Lightbox den Body sperren", async () => {
    const h = harness();
    const dispose = controlSmoothScroll(h.env);
    await settle();
    assert.deepEqual(h.calls, ["start"]);
    h.setLock(true);
    h.setLock(false);
    assert.deepEqual(h.calls, ["start", "stop", "start"]);
    dispose();
  });

  it("übernimmt eine Sperre, die schon beim Laden besteht", async () => {
    const h = harness({ locked: true });
    const dispose = controlSmoothScroll(h.env);
    await settle();
    assert.deepEqual(h.calls, ["stop"]);
    dispose();
  });

  it("baut Lenis ab, wenn reduzierte Bewegung während des Ladens aktiviert wird", async () => {
    const h = harness();
    const dispose = controlSmoothScroll(h.env);
    h.setMedia(false);
    await settle();
    assert.deepEqual(h.calls, ["destroy"]);
    dispose();
  });

  it("verbindet ScrollTrigger unabhängig von der Ladereihenfolge", async () => {
    const h = harness();
    const dispose = controlSmoothScroll(h.env);
    await settle();
    let updates = 0;
    connectScrollTrigger(() => updates++);
    assert.equal(h.subscriptions.length, 1);
    h.subscriptions[0]();
    assert.equal(updates, 1);
    dispose();
    assert.ok(h.calls.includes("unsubscribe"));
    assert.ok(h.calls.includes("destroy"));
  });

  it("bleibt bei einem Ladefehler beim nativen Scrollen", async () => {
    const h = harness({ fail: true });
    const dispose = controlSmoothScroll(h.env);
    await settle();
    h.setLock(true);
    assert.deepEqual(h.calls, []);
    dispose();
  });
});
