import { useId, useState } from "react";
import { Shot } from "@/components/media";

export function CompareSlider({
  city,
  beforeAlt,
  afterAlt,
}: {
  city: string;
  beforeAlt: string;
  afterAlt: string;
}) {
  const [pos, setPos] = useState(52);
  const id = useId();

  return (
    <figure className="compare-slider">
      <div className="relative aspect-[16/10] overflow-hidden bg-elevated">
        <Shot
          name="lack"
          alt={afterAlt}
          className="absolute inset-0 h-full w-full"
          sizes="(min-width: 1024px) 60vw, 100vw"
          framed={false}
        />
        <div
          className="absolute inset-0 border-r border-white/70"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <Shot
            name="dellen"
            alt={beforeAlt}
            className="absolute inset-0 h-full w-full"
            sizes="(min-width: 1024px) 60vw, 100vw"
            framed={false}
          />
        </div>
        <label htmlFor={id} className="sr-only">
          Vorher-Nachher-Vergleich Fahrzeugaufbereitung {city}
        </label>
        <input
          id={id}
          type="range"
          min={4}
          max={96}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="compare-slider-range"
        />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-bg/80 px-3 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-subtle">
          Vorher
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-bg/80 px-3 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-subtle">
          Nachher
        </span>
      </div>
      <figcaption className="mt-3 text-xs leading-relaxed text-subtle">
        Beispielfotos aus der Werkstatt in Horb am Neckar, keine Kundenfahrzeuge,
        Kennzeichen entfernt. Ziehen Sie den Regler – auch per Tastatur.
      </figcaption>
    </figure>
  );
}
