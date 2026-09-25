import { berlinWallToUtc, defaultDurationMinutes, rangesOverlap } from "./booking-time.ts";

export type SlotBusyWindow = { start: string; end: string; resourceId: number };

/** Provisional package duration; the owner still sets the final interval. */
export function requestedSlotBusy(
  windows: SlotBusyWindow[],
  date: string,
  slot: string,
  packageId: string,
) {
  const start = berlinWallToUtc(date, slot);
  const end = new Date(start.getTime() + (defaultDurationMinutes[packageId] ?? 180) * 60_000);
  return [1, 2].every((resource) =>
    windows.some(
      (window) =>
        window.resourceId === resource &&
        rangesOverlap(start, end, new Date(window.start), new Date(window.end)),
    ),
  );
}
