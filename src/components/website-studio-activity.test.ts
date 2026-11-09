import assert from "node:assert/strict";
import test from "node:test";
import { createStudioActivityRegistry } from "./website-studio-activity.ts";

test("media-only editing stays dirty until every changed card is saved or discarded", () => {
  const activity = createStudioActivityRegistry();
  assert.deepEqual(activity.update("first", { dirty: true, busy: false }), { dirty: true, busy: false });
  activity.update("second", { dirty: true, busy: false });
  assert.deepEqual(activity.update("first", null), { dirty: true, busy: false });
  assert.deepEqual(activity.update("second", { dirty: false, busy: false }), { dirty: false, busy: false });
});

test("upload completion does not release a pending save or erase another media draft", () => {
  const activity = createStudioActivityRegistry();
  activity.update("editing", { dirty: true, busy: false });
  activity.update("saving", { dirty: true, busy: true });
  assert.deepEqual(activity.update("upload", { dirty: false, busy: true }), { dirty: true, busy: true });
  assert.deepEqual(activity.update("upload", null), { dirty: true, busy: true });
  assert.deepEqual(activity.update("saving", null), { dirty: true, busy: false });
  assert.deepEqual(activity.update("editing", null), { dirty: false, busy: false });
});

test("failed saves keep the changed card dirty after the request finishes", () => {
  const activity = createStudioActivityRegistry();
  activity.update("image", { dirty: true, busy: true });
  assert.deepEqual(activity.update("image", { dirty: true, busy: false }), { dirty: true, busy: false });
  assert.deepEqual(activity.update("unknown-card", null), { dirty: true, busy: false });
});
