import { useEffect, useRef, type RefObject } from "react";

type Gsap = typeof import("gsap").gsap;
type ScrollTriggerType = typeof import("gsap/ScrollTrigger").ScrollTrigger;
export type ScrollMotionTools = { gsap: Gsap; ScrollTrigger: ScrollTriggerType };

/** Desktop-only editorial motion; small screens and reduced motion stay static. */
export const DESKTOP_MOTION = "(min-width: 960px) and (prefers-reduced-motion: no-preference)";

let tools: Promise<ScrollMotionTools> | undefined;

export function loadScrollMotion() {
  tools ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
    ([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      return { gsap, ScrollTrigger };
    },
    (error: unknown) => {
      tools = undefined; // A later visit may retry; the page stays static meanwhile.
      throw error;
    },
  );
  return tools;
}

/**
 * Runs `setup` inside a GSAP matchMedia context while `query` matches. GSAP is
 * downloaded only once the query first matches, so phones and reduced-motion
 * visitors never load it. Every tween and ScrollTrigger is reverted when
 * the query stops matching or the component unmounts (e.g. on route change).
 */
export function useScrollMotion(
  query: string,
  setup: (tools: ScrollMotionTools) => void | (() => void),
  scope?: RefObject<Element | null>,
) {
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    const media = window.matchMedia(query);
    let disposed = false;
    let revert: (() => void) | undefined;
    const start = () => {
      if (!media.matches || revert) return;
      media.removeEventListener("change", start);
      loadScrollMotion()
        .then((loaded) => {
          if (disposed || revert) return;
          const context = loaded.gsap.matchMedia(scope?.current ?? undefined);
          context.add(query, () => setupRef.current(loaded));
          revert = () => context.revert();
        })
        .catch(() => {
          // Motion is an enhancement; content and navigation work without it.
        });
    };
    if (media.matches) start();
    else media.addEventListener("change", start);
    return () => {
      disposed = true;
      media.removeEventListener("change", start);
      revert?.();
    };
  }, [query, scope]);
}
