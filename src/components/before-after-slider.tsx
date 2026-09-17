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

export function BeforeAfterSlider({
  beforeImage = "/media/lack-800.webp",
  afterImage = "/media/finish-800.webp",
  beforeAlt = "Lack vor der Lackkorrektur mit feinen Waschkratzern",
  afterAlt = "Lack nach der mehrstufigen Politur unter Prüflicht",
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
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    setSliderPos(percent);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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
    if (e.key === "ArrowLeft") {
      setSliderPos((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight") {
      setSliderPos((prev) => Math.min(100, prev + 5));
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
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="group relative aspect-[16/10] sm:aspect-[16/9] w-full cursor-ew-resize select-none overflow-hidden rounded-card border border-line bg-surface touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* After Image */}
        <img
          src={afterImage}
          alt={afterAlt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          draggable={false}
        />

        {/* Before Image */}
        <div
          className="absolute inset-0 h-full w-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img
            src={beforeImage}
            alt={beforeAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>

        {/* Labels */}
        <span className="absolute left-4 top-4 rounded bg-bg/80 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.14em] text-fg backdrop-blur-sm pointer-events-none border border-line">
          {beforeLabel}
        </span>
        <span className="absolute right-4 top-4 rounded bg-bg/80 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.14em] text-fg backdrop-blur-sm pointer-events-none border border-line">
          {afterLabel}
        </span>

        {/* Divider Line */}
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
        <span>◀ Schieberegler nach links/rechts ziehen</span>
        <span>Direkter Lackvergleich unter Prüflicht</span>
      </div>
    </div>
  );
}
