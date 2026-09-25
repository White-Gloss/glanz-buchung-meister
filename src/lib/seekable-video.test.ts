import assert from "node:assert/strict";
import test from "node:test";
import { loadSeekableVideo } from "./seekable-video.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("a full HTTP 200 response becomes a seekable local source and is released", { timeout: 5000 }, async (t) => {
  const original = new Blob(["original film"], { type: "video/mp4" });
  t.mock.method(globalThis, "fetch", async () => new Response(original));
  const revoked: string[] = [];
  t.mock.method(URL, "createObjectURL", (blob: Blob) => {
    assert.equal(blob.size, original.size);
    return "blob:test-film";
  });
  t.mock.method(URL, "revokeObjectURL", (url: string) => revoked.push(url));
  let didLoad!: () => void;
  const loaded = new Promise<void>((resolve) => { didLoad = resolve; });
  const video = { src: "", load: t.mock.fn(() => didLoad()) };
  const failed = t.mock.fn();
  const cleanup = loadSeekableVideo(video, "/original.mp4", failed);
  await loaded;
  assert.equal(video.src, "blob:test-film");
  assert.equal(video.load.mock.callCount(), 1);
  assert.equal(failed.mock.callCount(), 0);
  cleanup();
  assert.deepEqual(revoked, ["blob:test-film"]);
});

test("unmount aborts a pending download without changing the video or showing an error", async (t) => {
  let complete!: (response: Response) => void;
  let signal!: AbortSignal;
  t.mock.method(globalThis, "fetch", (_url: string, options: RequestInit) => {
    signal = options.signal as AbortSignal;
    return new Promise<Response>((resolve) => { complete = resolve; });
  });
  const video = { src: "", load: t.mock.fn() };
  const failed = t.mock.fn();
  const cleanup = loadSeekableVideo(video, "/original.mp4", failed);
  cleanup();
  assert.equal(signal.aborted, true);
  complete(new Response("late film"));
  await tick();
  assert.equal(video.src, "");
  assert.equal(video.load.mock.callCount(), 0);
  assert.equal(failed.mock.callCount(), 0);
});

test("a failed download keeps the poster fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  const video = { src: "", load: t.mock.fn() };
  const failed = t.mock.fn();
  const cleanup = loadSeekableVideo(video, "/original.mp4", failed);
  await tick();
  assert.equal(failed.mock.callCount(), 1);
  assert.equal(video.src, "");
  cleanup();
});
