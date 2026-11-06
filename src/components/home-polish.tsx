import { useEffect, useRef } from "react";
import { DESKTOP_MOTION, useScrollMotion } from "@/lib/scroll-motion";
import { setupParallax } from "@/lib/studio-motion";

/**
 * Homepage-only "Polished reveal" scroll motion.
 * Slow, confident, clearcoat-like — no palette changes, no copy changes.
 */
export function HomePolish() {
  const progressRef = useRef<HTMLDivElement>(null);

  useScrollMotion(
    DESKTOP_MOTION,
    (tools) => {
      const { ScrollTrigger } = tools;
      const main = document.querySelector<HTMLElement>('[data-home="polish"]');
      if (!main) return;
      // Paketbilder und Werkstattbild gleiten in ihren Rahmen (data-parallax-frame).
      setupParallax(tools, main);
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
    // Erster Abschnitt mit Parallaxe (Bento-Pakete): GSAP lädt kurz davor.
    "#pakete",
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

    /* ---- Masked line reveals for section headlines (studio.css §6) ---- */
    // Headlines already on screen are marked first, so nothing that the
    // visitor has seen is hidden again; only those below the fold rise in.
    const lines = [...main.querySelectorAll<HTMLElement>("[data-lines]")];
    if (lines.length && !reduce) {
      const root = document.documentElement;
      const fold = window.innerHeight;
      const pending = lines.filter((el) => {
        const visible = el.getBoundingClientRect().top < fold;
        if (visible) el.classList.add("is-in");
        return !visible;
      });
      root.dataset.lines = "armed";
      onceIn(pending, (el) => el.classList.add("is-in"), {
        threshold: 0,
        rootMargin: "0px 0px -12% 0px",
      });
      cleanups.push(() => {
        delete root.dataset.lines;
      });
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
