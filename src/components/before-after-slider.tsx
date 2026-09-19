import { useState, useRef, useCallback } from "react";

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
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    setSliderPos(percent);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.focus({ preventScroll: true });
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updatePosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        setSliderPos((prev) => Math.max(0, prev - 5));
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        setSliderPos((prev) => Math.min(100, prev + 5));
        break;
      case "Home":
        e.preventDefault();
        setSliderPos(0);
        break;
      case "End":
        e.preventDefault();
        setSliderPos(100);
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
        aria-valuenow={sliderPos}
        aria-valuetext={`${sliderPos}% ${beforeLabel}, ${100 - sliderPos}% ${afterLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={() => setIsDragging(false)}
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
          className="absolute inset-y-0 w-0.5 bg-accent-fg/80 pointer-events-none transition-shadow duration-200"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full border border-line bg-bg/95 text-fg shadow-xl backdrop-blur transition-transform group-hover:scale-105 active:scale-95">
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
