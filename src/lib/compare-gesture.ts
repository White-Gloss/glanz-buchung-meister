// Reine Gestenlogik fuer den Vorher-Nachher-Slider (ohne React/DOM), damit sie
// per node:test pruefbar ist. Prinzipien nach Apple "Designing Fluid Interfaces":
// 1:1-Tracking mit Griff-Versatz, Richtungserkennung vor dem Festlegen (Touch)
// und stufenlose Position statt ganzer Prozent.

/** Radius um den Griff, in dem ein Druck als "Griff anfassen" gilt (px). */
export const HANDLE_GRAB_RADIUS = 28;

/** Mindestbewegung, bevor eine Touch-Geste einer Richtung zugeordnet wird (px). */
export const TOUCH_SLOP = 8;

export type GestureMode = "pending" | "dragging";

export interface GestureStart {
  mode: GestureMode;
  /** Abstand Griff minus Zeiger in px; bleibt waehrend des Ziehens konstant. */
  offsetPx: number;
  /** Ob die Position sofort auf den Zeiger springen soll (Klick neben den Griff). */
  jumpNow: boolean;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Beginn einer Geste. Wer den Griff trifft, behaelt seinen Greifversatz – der
 * Griff springt nicht unter den Finger. Maus/Stift ziehen sofort; Touch wartet,
 * bis klar ist, ob der Nutzer horizontal zieht oder die Seite scrollt.
 */
export function startGesture(
  pointerX: number,
  left: number,
  width: number,
  currentPercent: number,
  pointerType: string,
): GestureStart {
  const handleX = left + (clampPercent(currentPercent) / 100) * width;
  const onHandle = Math.abs(pointerX - handleX) <= HANDLE_GRAB_RADIUS;
  const offsetPx = onHandle ? handleX - pointerX : 0;
  if (pointerType === "touch") {
    return { mode: "pending", offsetPx, jumpNow: false };
  }
  return { mode: "dragging", offsetPx, jumpNow: !onHandle };
}

/** Ordnet eine Touch-Bewegung einer Richtung zu, sobald sie die Schwelle passiert. */
export function resolveDirection(
  dx: number,
  dy: number,
  slop: number = TOUCH_SLOP,
): "pending" | "horizontal" | "vertical" {
  if (Math.hypot(dx, dy) < slop) return "pending";
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

/** Stufenlose Position in Prozent – kein Runden, sonst ruckelt es auf breiten Bildschirmen. */
export function positionFromPointer(
  pointerX: number,
  left: number,
  width: number,
  offsetPx = 0,
): number | null {
  if (!(width > 0)) return null;
  return clampPercent(((pointerX + offsetPx - left) / width) * 100);
}
