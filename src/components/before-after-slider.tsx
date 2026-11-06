import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPercent,
  positionFromPointer,
  resolveDirection,
  startGesture,
} from "@/lib/compare-gesture";

interface BeforeAfterSliderProps {
  beforeImage?: string;
  afterImage?: string;
  beforeAlt?: string;
  afterAlt?: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

function ComparisonImage({ src, alt }: { src: string; alt: string }) {
  // Bundled compare-* images have responsive variants. Leave other URLs alone.
  const name = src.match(/^\/media\/(compare-before|compare-after)-800\.webp$/)?.[1];
  const sizes = "(min-width: 1280px) 1200px, 100vw";
  return (
    <picture>
      {name ? (
        <>
          <source
            type="image/avif"
            srcSet={`/media/${name}-480.avif 480w, /media/${name}-800.avif 800w, /media/${name}-1200.avif 1200w`}
            sizes={sizes}
          />
          <source
            type="image/webp"
            srcSet={`/media/${name}-480.webp 480w, /media/${name}-800.webp 800w, /media/${name}-1200.webp 1200w`}
            sizes={sizes}
          />
        </>
      ) : null}
      <img
        src={src}
        alt={alt}
        width={name ? 1200 : undefined}
        height={name ? 800 : undefined}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        draggable={false}
      />
    </picture>
  );
}

export function BeforeAfterSlider({
  beforeImage = "/media/compare-before-800.webp",
  afterImage = "/media/compare-after-800.webp",
  beforeAlt = "Schwarzer Lack vor der Lackkorrektur mit deutlichen Waschkratzern und Swirls unter Prüflicht",
  afterAlt = "Schwarzer Lack nach der Lackkorrektur mit tiefer Spiegelung und klarem Glanz",
  beforeLabel = "Vorher",
  afterLabel = "Nach der Politur",
  className = "",
}: BeforeAfterSliderProps) {
  // Stufenlose Position (Float). Gerundet wird nur fuer Screenreader, sonst
  // springt die Linie auf breiten Bildschirmen in ~12-px-Schritten.
  const [sliderPos, setSliderPos] = useState(50);
  const [isPressed, setIsPressed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(50);
  const frameRef = useRef(0);
  const gestureRef = useRef<{
    id: number;
    mode: "pending" | "dragging";
    startX: number;
    startY: number;
    offsetPx: number;
  } | null>(null);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // Pointer-Events kommen haeufiger als Frames: pro Frame genau ein Render.
  const commit = useCallback((next: number) => {
    posRef.current = next;
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      setSliderPos(posRef.current);
    });
  }, []);

  const track = useCallback(
    (clientX: number, offsetPx: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = positionFromPointer(clientX, rect.left, rect.width, offsetPx);
      if (next !== null) commit(next);
    },
    [commit],
  );

  const endGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    gestureRef.current = null;
    setIsPressed(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || gestureRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    e.currentTarget.focus({ preventScroll: true });
    const start = startGesture(e.clientX, rect.left, rect.width, posRef.current, e.pointerType);
    gestureRef.current = {
      id: e.pointerId,
      mode: start.mode,
      startX: e.clientX,
      startY: e.clientY,
      offsetPx: start.offsetPx,
    };
    // Feedback beim Druck, nicht erst beim Loslassen.
    setIsPressed(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (start.jumpNow) track(e.clientX, 0);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.mode === "pending") {
      const dir = resolveDirection(e.clientX - g.startX, e.clientY - g.startY);
      if (dir === "pending") return;
      if (dir === "vertical") {
        // Nutzer scrollt die Seite: Geste sauber abgeben, Slider bleibt stehen.
        endGesture(e);
        return;
      }
      g.mode = "dragging";
    }
    track(e.clientX, g.offsetPx);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    // Touch-Tipp ohne Bewegung neben den Griff: erst beim Loslassen springen,
    // damit ein beginnender Scroll den Slider nicht verstellt.
    if (g && g.id === e.pointerId && g.mode === "pending" && g.offsetPx === 0) {
      track(e.clientX, 0);
    }
    endGesture(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    endGesture(e);
  };

  const step = (next: number) => commit(clampPercent(next));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        step(posRef.current - 5);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        step(posRef.current + 5);
        break;
      case "Home":
        e.preventDefault();
        step(0);
        break;
      case "End":
        e.preventDefault();
        step(100);
        break;
    }
  };

  return (
    <div className={`relative flex flex-col gap-3 ${className}`}>
      <div
        ref={containerRef}
        role="slider"
        tabIndex={0}
        aria-label="Vorher-Nachher-Vergleich der Lackaufbereitung"
        aria-valuenow={Math.round(sliderPos)}
        aria-valuetext={`${Math.round(sliderPos)}% ${beforeLabel}, ${100 - Math.round(sliderPos)}% ${afterLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={() => {
          gestureRef.current = null;
          setIsPressed(false);
        }}
        data-pressed={isPressed ? "true" : undefined}
        className="group relative aspect-[16/10] sm:aspect-[16/9] w-full cursor-ew-resize select-none overflow-hidden rounded-card border border-line bg-surface touch-pan-y touch-pinch-zoom focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ComparisonImage src={afterImage} alt={afterAlt} />

        <div
          className="absolute inset-0 h-full w-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <ComparisonImage src={beforeImage} alt={beforeAlt} />
        </div>

        <span className="absolute left-4 top-4 rounded bg-bg/80 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.14em] text-fg backdrop-blur-sm pointer-events-none border border-line">
          {beforeLabel}
        </span>
        <span className="absolute right-4 top-4 rounded bg-bg/80 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.14em] text-fg backdrop-blur-sm pointer-events-none border border-line">
          {afterLabel}
        </span>

        <div
          className="absolute inset-y-0 w-0.5 bg-accent-fg/80 pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full border border-line bg-bg/95 text-fg shadow-xl backdrop-blur transition-transform duration-150 ease-out group-hover:scale-105 group-data-[pressed=true]:scale-90 group-data-[pressed=true]:duration-100 motion-reduce:transition-none">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 text-fg"
              aria-hidden="true"
            >
              <path d="m9 18-6-6 6-6" />
              <path d="m15 6 6 6-6 6" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-subtle px-1">
        <span>Schieberegler nach links/rechts ziehen</span>
        <span>Direkter Lackvergleich unter Prüflicht</span>
      </div>
    </div>
  );
}
