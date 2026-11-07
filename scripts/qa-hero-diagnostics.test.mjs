import assert from "node:assert/strict";
import test from "node:test";
import { heroEvidenceUrl, redactHeroEvidence, createHeroPhaseTracker } from "./qa/hero-diagnostics.mjs";

test("hero evidence retains resource paths without credentials, queries or fragments", () => {
  assert.equal(heroEvidenceUrl("https://user:secret@example.com/film.mp4?token=private#offset"), "https://example.com/film.mp4");
  assert.equal(heroEvidenceUrl("blob:http://127.0.0.1:8082/private-object-id"), "blob:http://127.0.0.1:8082/[object-url]");
  assert.equal(heroEvidenceUrl("data:video/mp4;base64,private"), "data:[redacted]");
  assert.equal(heroEvidenceUrl(""), "");
});

test("hero failure evidence keeps the original stack and media geometry while redacting nested URLs", () => {
  const result = redactHeroEvidence({
    stack: "Error: failed https://user:secret@example.com/film.mp4?token=private#offset\n at file:///qa/check.mjs:42:7",
    network: [{ url: "http://127.0.0.1:8082/media/film.mp4?signature=private", status: 404 }],
    geometry: { scrollY: 80, video: { source: "blob:http://127.0.0.1:8082/private-object-id", readyState: 1, duration: 8, time: 0 } },
  });
  assert.match(result.stack, /at file:\/\/\/qa\/check\.mjs:42:7/);
  assert.equal(result.geometry.video.readyState, 1);
  assert.equal(result.geometry.scrollY, 80);
  assert.equal(result.network[0].status, 404);
  assert.doesNotMatch(JSON.stringify(result), /private|secret|user:|token=|signature=/);
});

test("phase tracker identifies the failing wait without changing the thrown failure or its deadline", async () => {
  const result = {};
  const log = [];
  let tick = 100;
  const tracker = createHeroPhaseTracker(result, { now: () => ++tick, log: (message) => log.push(message) });
  await tracker.run("video-readiness", async () => 2);
  const timeout = new Error("page.waitForFunction: Timeout 10000ms exceeded.");
  timeout.stack += "\n at file:///qa/check.mjs:99:5";
  await assert.rejects(tracker.run("film-resume", async () => { throw timeout; }), (error) => error === timeout);
  assert.equal(result.phase, "film-resume");
  assert.equal(result.phases[0].status, "passed");
  assert.equal(result.phases[1].status, "failed");
  assert.match(result.phases[1].error.stack, /check\.mjs:99:5/);
  assert.match(log.join("\n"), /film-resume/);
  assert.match(log.join("\n"), /10000ms/);
});
