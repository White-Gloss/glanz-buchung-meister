import { useEffect, type RefObject } from "react";
import { DESKTOP_MOTION, loadScrollMotion, useScrollMotion, type ScrollMotionTools } from "./scroll-motion";

/** Magnet-Buttons nur mit Maus/Trackpad; Touch und Reduced Motion bleiben ruhig. */
export const MAGNETIC_QUERY =
  "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/** ±5 % Versatz bei 12 % Überskalierung, abgestimmt auf studio.css (Abschnitt 10). */
export const PARALLAX = { range: 5, scale: 1.12 } as const;

/** Magnet: Folgen mit power3.out, Rückkehr als Feder (elastic.out 1/0.75 ≈ 10 % Überschwinger). */
export const MAGNETIC = {
  follow: { duration: 0.6, ease: "power3.out" },
  release: { duration: 0.9, ease: "elastic.out(1, 0.75)" },
} as const;

/**
 * Bilder in `[data-parallax-frame]` gleiten im Rahmen gegen die Scrollrichtung.
 * Rahmen im ersten Viewport starten bei 0 (kein Sprung beim GSAP-Start), alle
 * anderen laufen symmetrisch von −range bis +range durch den Viewport.
 */
export function setupParallax({ gsap }: ScrollMotionTools, root: ParentNode) {
  const frames = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax-frame]"));
  for (const frame of frames) {
    const image = frame.querySelector("img");
    if (!image) continue;
    const firstView = frame.getBoundingClientRect().top < window.innerHeight;
    gsap.fromTo(
      image,
      { yPercent: firstView ? 0 : -PARALLAX.range, scale: PARALLAX.scale },
      {
        yPercent: PARALLAX.range,
        scale: PARALLAX.scale,
        ease: "none",
        scrollTrigger: {
          trigger: frame,
          start: firstView ? "top top" : "top bottom",
          end: "bottom top",
          // Lenis glättet bereits; ein zweites Scrub-Delay würde nachziehen.
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );
  }
}

/** Parallaxe für alle Rahmen innerhalb von `scope` (nur Desktop, siehe DESKTOP_MOTION). */
export function useParallaxFrames(scope: RefObject<Element | null>) {
  useScrollMotion(
    DESKTOP_MOTION,
    (tools) => {
      if (scope.current) setupParallax(tools, scope.current);
    },
    scope,
    scope,
  );
}

/**
 * Magnetischer Button: folgt dem Zeiger innerhalb seiner Fläche und federt beim
 * Verlassen zurück. GSAP wird erst beim ersten Hover geladen, damit Seiten ohne
 * Scroll-Animation dafür keinen Download auslösen.
 */
export function useMagnetic<T extends HTMLElement>(ref: RefObject<T | null>, strength = 0.3) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const media = window.matchMedia(MAGNETIC_QUERY);
    let tools: ScrollMotionTools | undefined;
    let xTo: ((value: number) => void) | undefined;
    let yTo: ((value: number) => void) | undefined;
    let disposed = false;
    let hovering = false;

    const usable = (event: PointerEvent) => media.matches && event.pointerType === "mouse";
    const arm = () => {
      if (!tools) return;
      const { gsap } = tools;
      gsap.killTweensOf(element);
      xTo = gsap.quickTo(element, "x", MAGNETIC.follow);
      yTo = gsap.quickTo(element, "y", MAGNETIC.follow);
    };
    const follow = (event: PointerEvent) => {
      if (!tools || !xTo || !yTo) return;
      // Mittelpunkt ohne den eigenen Versatz messen, sonst „flieht“ der Button.
      const rect = element.getBoundingClientRect();
      const x = Number(tools.gsap.getProperty(element, "x")) || 0;
      const y = Number(tools.gsap.getProperty(element, "y")) || 0;
      xTo((event.clientX - (rect.left - x + rect.width / 2)) * strength);
      yTo((event.clientY - (rect.top - y + rect.height / 2)) * strength);
    };
    const enter = (event: PointerEvent) => {
      if (!usable(event)) return;
      hovering = true;
      if (tools) {
        arm();
        return;
      }
      loadScrollMotion()
        .then((loaded) => {
          if (disposed) return;
          tools = loaded;
          if (hovering) arm();
        })
        .catch(() => {
          // Ohne GSAP bleibt der Button einfach statisch.
        });
    };
    const move = (event: PointerEvent) => {
      if (usable(event)) follow(event);
    };
    const leave = () => {
      hovering = false;
      if (!tools) return;
      xTo = yTo = undefined;
      tools.gsap.killTweensOf(element);
      tools.gsap.to(element, { x: 0, y: 0, ...MAGNETIC.release });
    };

    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    return () => {
      disposed = true;
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      if (tools) {
        tools.gsap.killTweensOf(element);
        tools.gsap.set(element, { clearProps: "transform" });
      }
    };
  }, [ref, strength]);
}
