import type Lenis from "lenis";

/**
 * Lenis nur dort, wo Mausrad oder Trackpad scrollen. Auf iOS und Android
 * bleibt das native Momentum-Scrolling: es ist bereits physikalisch gedämpft,
 * und eine JS-Nachbildung würde dort spürbar nachlaufen und Akku kosten.
 * Reduzierte Bewegung schaltet Lenis vollständig ab.
 */
export const SMOOTH_SCROLL_QUERY =
  "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

type LenisLike = Pick<Lenis, "start" | "stop" | "destroy" | "on">;

export type SmoothScrollEnv = {
  media: Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;
  /** Lädt Lenis erst bei Bedarf (eigener Chunk, ca. 5 KB gzip). */
  create: () => Promise<LenisLike>;
  /** true, solange Menü, Lightbox oder ein Radix-Dialog den Body sperren. */
  isLocked: () => boolean;
  observeLock: (onChange: () => void) => () => void;
};

let active: LenisLike | null = null;
let scrollTriggerUpdate: (() => void) | null = null;
let unbindScrollTrigger: (() => void) | undefined;

function bindScrollTrigger() {
  unbindScrollTrigger?.();
  unbindScrollTrigger =
    active && scrollTriggerUpdate ? active.on("scroll", scrollTriggerUpdate) : undefined;
}

/**
 * Wird von scroll-motion aufgerufen, sobald GSAP geladen ist. ScrollTrigger
 * rechnet dann im selben Frame wie Lenis – keine Ein-Frame-Verzögerung bei
 * Scrub-Animationen. Reihenfolge der Ladevorgänge ist egal.
 */
export function connectScrollTrigger(update: () => void) {
  scrollTriggerUpdate = update;
  bindScrollTrigger();
}

/** Steuert Lenis über die Lebensdauer der öffentlichen Seiten. */
export function controlSmoothScroll(env: SmoothScrollEnv): () => void {
  let instance: LenisLike | null = null;
  let loading = false;
  let disposed = false;

  const applyLock = () => {
    if (!instance) return;
    if (env.isLocked()) instance.stop();
    else instance.start();
  };
  const setActive = (next: LenisLike | null) => {
    instance = next;
    active = next;
    bindScrollTrigger();
  };
  const enable = () => {
    if (instance || loading || disposed) return;
    loading = true;
    env.create().then(
      (created) => {
        loading = false;
        // Während des Ladens kann die Bedingung entfallen sein (Reduced
        // Motion umgeschaltet, Seite verlassen): dann sofort wieder abbauen.
        if (disposed || !env.media.matches) {
          created.destroy();
          return;
        }
        setActive(created);
        applyLock();
      },
      () => {
        // Smooth Scrolling ist eine Verbesserung; natives Scrollen bleibt.
        loading = false;
      },
    );
  };
  const disable = () => {
    if (!instance) return;
    instance.destroy();
    setActive(null);
  };
  const onMedia = () => (env.media.matches ? enable() : disable());

  env.media.addEventListener("change", onMedia);
  const unobserve = env.observeLock(applyLock);
  onMedia();

  return () => {
    disposed = true;
    env.media.removeEventListener("change", onMedia);
    unobserve();
    disable();
  };
}

export function browserSmoothScrollEnv(): SmoothScrollEnv {
  return {
    media: window.matchMedia(SMOOTH_SCROLL_QUERY),
    create: () =>
      import("lenis").then(
        ({ default: LenisClass }) =>
          new LenisClass({
            autoRaf: true,
            // Standardwerte von Lenis 1.3 (lerp 0.1): gedämpft, aber ohne
            // schwammiges Nachlaufen.
            smoothWheel: true,
            // Innere Scrollbereiche (Formulare, Listen, Karten) scrollen nativ.
            allowNestedScroll: true,
            // Klick auf einen Link zu einer anderen Seite stoppt Restschwung.
            stopInertiaOnNavigate: true,
            // Anker bleiben beim Router (scrollIntoView mit scroll-margin);
            // zwei konkurrierende Anker-Animationen würden ruckeln.
            anchors: false,
            // Offene Dialoge (Menü, Foto-/Videoansicht) scrollen nativ.
            prevent: (node) => node.nodeName === "DIALOG",
          }),
      ),
    isLocked: () => getComputedStyle(document.body).overflow === "hidden",
    observeLock: (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["style", "class", "data-nav", "data-scroll-locked"],
      });
      return () => observer.disconnect();
    },
  };
}
