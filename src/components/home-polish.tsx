import { useEffect, useRef } from "react";
import { DESKTOP_MOTION, useScrollMotion } from "@/lib/scroll-motion";

/**
 * Homepage-only "Polished reveal" scroll motion.
 * Slow, confident, clearcoat-like — no palette changes, no copy changes.
 */
export function HomePolish() {
  const progressRef = useRef<HTMLDivElement>(null);

  useScrollMotion(
    DESKTOP_MOTION,
    ({ gsap, ScrollTrigger }) => {
      const main = document.querySelector<HTMLElement>('[data-home="polish"]');
      if (!main) return;
      const image = main.querySelector(".workshop-personal .film-chapter-media img");
      if (image)
        gsap.fromTo(
          image,
          { scale: 1.04, yPercent: 1 },
          {
            scale: 1.025,
            yPercent: -1,
            ease: "none",
            scrollTrigger: {
              trigger: image.closest(".film-chapter"),
              start: "top bottom",
              end: "bottom top",
              scrub: 0.4,
            },
          },
        );
      // Lazy sections (reviews, booking) change the page height after load.
      let timer = 0;
      const resize = new ResizeObserver(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => ScrollTrigger.refresh(), 200);
      });
      resize.observe(main);
      return () => {
        resize.disconnect();
        window.clearTimeout(timer);
      };
    },
    undefined,
    ".workshop-personal",
  );

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const main = document.querySelector<HTMLElement>('[data-home="polish"]');
    if (!main) return;

    const cleanups: Array<() => void> = [];

    /* ---- Hero entrance (once on load) ---- */
    const hero = main.querySelector<HTMLElement>("[data-hero-enter]");
    const markHero = () => hero?.classList.add("is-in");
    if (reduce) {
      markHero();
    } else {
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(markHero);
      });
      cleanups.push(() => window.cancelAnimationFrame(id));
    }

    /* ---- Shared once-in-view observer ---- */
    const onceIn = (
      nodes: HTMLElement[],
      onIn: (el: HTMLElement) => void,
      opts?: IntersectionObserverInit,
    ) => {
      if (!nodes.length) return;
      if (reduce) {
        nodes.forEach(onIn);
        return;
      }
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          onIn(entry.target as HTMLElement);
          io.unobserve(entry.target);
        }
      }, opts ?? { threshold: 0.12, rootMargin: "10% 0px -8% 0px" });
      nodes.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    };

    onceIn(
      [...main.querySelectorAll<HTMLElement>("[data-reveal]")],
      (el) => el.classList.add("is-in"),
    );

    onceIn(
      [...main.querySelectorAll<HTMLElement>("[data-stagger]")],
      (el) => el.classList.add("is-in"),
    );

    onceIn(
      [...main.querySelectorAll<HTMLElement>("[data-polish-ba]")],
      (el) => el.classList.add("is-in"),
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );

    // Prices and factual statistics remain stable while scrolling.

    /* ---- Process step progressive highlight ---- */
    const steps = [...main.querySelectorAll<HTMLElement>("[data-process-step]")];
    if (steps.length) {
      const setActive = (active: HTMLElement | null) => {
        for (const step of steps) {
          step.classList.toggle("is-active", step === active);
        }
      };
      if (reduce) {
        setActive(steps[0] ?? null);
      } else {
        const io = new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter((e) => e.isIntersecting)
              .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
            if (visible[0]) setActive(visible[0].target as HTMLElement);
          },
          { threshold: [0.35, 0.55, 0.75], rootMargin: "-20% 0px -35% 0px" },
        );
        steps.forEach((el) => io.observe(el));
        setActive(steps[0] ?? null);
        cleanups.push(() => io.disconnect());
      }
    }

    /* ---- Page scroll progress (top cue) + hero scroll dim ---- */
    let frame = 0;
    let pageP = 0;
    let heroP = 0;
    const progressEl = progressRef.current;

    const paint = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const targetPage = Math.min(1, Math.max(0, window.scrollY / max));
      pageP += (targetPage - pageP) * 0.18;
      if (Math.abs(targetPage - pageP) < 0.0005) pageP = targetPage;
      if (progressEl) progressEl.style.transform = `scaleX(${pageP})`;

      const vh = window.innerHeight || 1;
      const targetHero = Math.min(1, Math.max(0, window.scrollY / (vh * 0.85)));
      heroP += (targetHero - heroP) * 0.14;
      if (Math.abs(targetHero - heroP) < 0.0005) heroP = targetHero;

      if (pageP !== targetPage || heroP !== targetHero) {
        frame = window.requestAnimationFrame(paint);
      } else {
        frame = 0;
      }
    };

    const onScroll = () => {
      if (reduce) return;
      if (frame) return;
      frame = window.requestAnimationFrame(paint);
    };

    if (!reduce) {
      paint();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (frame) window.cancelAnimationFrame(frame);
      });
    } else {
      if (progressEl) progressEl.style.transform = "scaleX(0)";
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div
      ref={progressRef}
      className="home-scroll-progress"
      data-scroll-progress
      aria-hidden
    />
  );
}
