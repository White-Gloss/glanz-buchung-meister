import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HANDLE_GRAB_RADIUS,
  TOUCH_SLOP,
  clampPercent,
  positionFromPointer,
  resolveDirection,
  startGesture,
} from "./compare-gesture.ts";

describe("compare slider gesture", () => {
  it("keeps the grab offset when the handle is grabbed off-centre", () => {
    // Griff bei 50 % von 1000 px = 500 px; Finger greift 10 px links daneben.
    const start = startGesture(490, 0, 1000, 50, "mouse");
    assert.equal(start.mode, "dragging");
    assert.equal(start.jumpNow, false);
    assert.equal(start.offsetPx, 10);
    // 1:1: 100 px Bewegung = 10 %, ohne Sprung zum Finger.
    assert.equal(positionFromPointer(590, 0, 1000, start.offsetPx), 60);
  });

  it("jumps to the pointer when clicking the track away from the handle", () => {
    const start = startGesture(200, 0, 1000, 50, "mouse");
    assert.equal(start.jumpNow, true);
    assert.equal(start.offsetPx, 0);
    assert.equal(positionFromPointer(200, 0, 1000, start.offsetPx), 20);
  });

  it("waits for a direction before moving on touch", () => {
    const start = startGesture(200, 0, 1000, 50, "touch");
    assert.equal(start.mode, "pending");
    assert.equal(start.jumpNow, false);
  });

  it("treats the handle radius inclusively", () => {
    const start = startGesture(500 + HANDLE_GRAB_RADIUS, 0, 1000, 50, "pen");
    assert.equal(start.jumpNow, false);
    assert.equal(start.offsetPx, -HANDLE_GRAB_RADIUS);
  });

  it("resolves direction only after the slop threshold", () => {
    assert.equal(resolveDirection(TOUCH_SLOP - 1, 0), "pending");
    assert.equal(resolveDirection(TOUCH_SLOP, 2), "horizontal");
    assert.equal(resolveDirection(3, TOUCH_SLOP), "vertical");
  });

  it("returns continuous, clamped positions", () => {
    assert.equal(positionFromPointer(250, 0, 1000), 25);
    assert.ok(Math.abs((positionFromPointer(333, 0, 1000) ?? 0) - 33.3) < 1e-9);
    assert.equal(positionFromPointer(-50, 0, 1000), 0);
    assert.equal(positionFromPointer(5000, 0, 1000), 100);
    assert.equal(positionFromPointer(10, 0, 0), null);
    assert.equal(clampPercent(Number.NaN), 0);
  });
});
