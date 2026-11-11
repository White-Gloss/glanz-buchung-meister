import { useEffect, useRef } from "react";
import "./automotive-journey.css";

/** Decorative brand imagery; real customer results stay in ResultsTeaser. */
export function AutomotiveJourney() {
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const motion = window.matchMedia("(min-width: 960px) and (min-height: 601px) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let visible = false;
    const paint = () => {
      frame = 0;
      if (!motion.matches || !visible || document.hidden) return;
      const rect = section.getBoundingClientRect();
      const stage = section.firstElementChild as HTMLElement;
      const distance = Math.max(1, section.offsetHeight - stage.offsetHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      section.style.setProperty("--journey-progress", String(progress));
      section.style.setProperty("--journey-reveal", String(Math.min(1, Math.max(0, (progress - 0.18) / 0.64))));
    };
    const schedule = () => {
      if (!frame && motion.matches && visible && !document.hidden)
        frame = window.requestAnimationFrame(paint);
    };
    const configure = () => {
      if (!motion.matches) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        section.style.removeProperty("--journey-progress");
        section.style.removeProperty("--journey-reveal");
      } else schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else { window.cancelAnimationFrame(frame); frame = 0; }
    }, { rootMargin: "200px 0px" });
    const resize = new ResizeObserver(schedule);
    observer.observe(section);
    resize.observe(section);
    // Lazy sections above this chapter can move its start without resizing it.
    const main = section.closest("main");
    if (main) resize.observe(main);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", schedule);
    motion.addEventListener("change", configure);
    return () => {
      observer.disconnect();
      resize.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("visibilitychange", schedule);
      motion.removeEventListener("change", configure);
    };
  }, []);
  return (
    <div ref={sectionRef} className="automotive-journey" aria-hidden="true">
      <div className="automotive-journey-stage">
        {["classic", "grand-tourer"].map((name) => (
          <div className="automotive-journey-frame" key={name}>
            <img
              src={`/media/automotive-journey/${name}-1280.webp`}
              srcSet={[640, 1280, 1920].map((width) => `/media/automotive-journey/${name}-${width}.webp ${width}w`).join(", ")}
              sizes="100vw"
              width={2688}
              height={1520}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          </div>
        ))}
        <span className="automotive-journey-line" />
      </div>
      <noscript><style>{`.automotive-journey { height: auto !important; } .automotive-journey-stage { position: relative !important; height: auto !important; } .automotive-journey-frame { position: relative !important; transform: none !important; aspect-ratio: 16 / 9; }`}</style></noscript>
    </div>
  );
}
