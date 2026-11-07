import assert from "node:assert/strict";
import test from "node:test";
import {
  createStudioRequestGate,
  moveStudioItem,
  studioCanPublish,
} from "./website-studio-state.ts";

test("gallery keyboard ordering moves a selected image and preserves all other images", () => {
  const photos = ["front", "interior", "finish"];
  assert.deepEqual(moveStudioItem(photos, 2, 0), ["finish", "front", "interior"]);
  assert.deepEqual(photos, ["front", "interior", "finish"]);
  assert.deepEqual(moveStudioItem(photos, 0, -1), photos);
  assert.deepEqual(moveStudioItem(photos, 3, 0), photos);
});

test("publish is available only for a saved draft different from the live version", () => {
  const ready = { dirty: false, busy: false, draftRevisionId: 4, publishedRevisionId: 3 };
  assert.equal(studioCanPublish(ready), true);
  assert.equal(studioCanPublish({ ...ready, dirty: true }), false);
  assert.equal(studioCanPublish({ ...ready, busy: true }), false);
  assert.equal(studioCanPublish({ ...ready, archived: true }), false);
  assert.equal(studioCanPublish({ ...ready, draftRevisionId: null }), false);
  assert.equal(studioCanPublish({ ...ready, publishedRevisionId: 4 }), false);
});

test("late cleanup invalidates only its own load and keeps the newer document load active", () => {
  const requests = createStudioRequestGate();
  const first = requests.begin();
  assert.equal(first.isCurrent(), true);
  const second = requests.begin();
  assert.equal(first.isCurrent(), false);
  first.cancel();
  assert.equal(second.isCurrent(), true);
  second.cancel();
  assert.equal(second.isCurrent(), false);
});
