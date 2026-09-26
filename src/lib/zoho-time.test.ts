import assert from "node:assert/strict";
import { test } from "node:test";
import {
  berlinWallToUtc,
  utcToBerlinWall,
  isoOffset,
  rangesOverlap,
  defaultWorkEnd,
  defaultDurationMinutes,
} from "./zoho-time.ts";

test("Berlin winter and summer wall clocks keep DST", () => {
  const winter = berlinWallToUtc("2026-01-15", "09:00");
  const summer = berlinWallToUtc("2026-07-15", "09:00");
  assert.equal(winter.toISOString(), "2026-01-15T08:00:00.000Z");
  assert.equal(summer.toISOString(), "2026-07-15T07:00:00.000Z");
  assert.deepEqual(utcToBerlinWall(winter), { date: "2026-01-15", time: "09:00" });
  assert.deepEqual(utcToBerlinWall(summer), { date: "2026-07-15", time: "09:00" });
  assert.equal(isoOffset(winter), "2026-01-15T09:00:00+01:00");
  assert.equal(isoOffset(summer), "2026-07-15T09:00:00+02:00");
});

test("spring-forward and fall-back days still resolve to a real instant", () => {
  const afterGap = berlinWallToUtc("2026-03-29", "03:30");
  assert.equal(utcToBerlinWall(afterGap).time, "03:30");
  const ambiguous = berlinWallToUtc("2026-10-25", "02:30");
  assert.equal(utcToBerlinWall(ambiguous).date, "2026-10-25");
});

test("overlap uses half-open intervals and default package durations", () => {
  const a = berlinWallToUtc("2026-04-02", "09:00");
  const b = berlinWallToUtc("2026-04-02", "11:00");
  const aEnd = defaultWorkEnd("basis", a);
  const bEnd = defaultWorkEnd("basis", b);
  assert.equal(defaultDurationMinutes.basis, 180);
  assert.equal(defaultDurationMinutes.premium, 360);
  assert.equal(defaultDurationMinutes.keramik, 1920);
  assert.equal(rangesOverlap(a, aEnd, b, bEnd), true);
  assert.equal(rangesOverlap(a, aEnd, berlinWallToUtc("2026-04-02", "12:00"), bEnd), false);
  const overnight = defaultWorkEnd("keramik", berlinWallToUtc("2026-04-02", "09:00"));
  assert.equal(utcToBerlinWall(overnight).date, "2026-04-03");
});
