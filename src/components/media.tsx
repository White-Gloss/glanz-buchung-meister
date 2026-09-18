import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  heroAvifSrcSet,
  heroPreloadHref,
  heroWebpSrcSet,
  logoAvifSrcSet,
  logoWebpSrcSet,
} from "@/data/media-src";
import { atelierPhotos, site } from "@/data/site";
import { cn } from "@/lib/utils";

export const heroPreload = {
  href: heroPreloadHref,
  type: "image/avif" as const,
  imageSrcSet: heroAvifSrcSet,
  imageSizes: "100vw",
};

/** Start frame of the scroll-film hero (dirty car). */
export const heroScrubPosterStart = "/media/hero-dirty.webp";
/** End frame / reduced-motion still (high-gloss finish). */
export const heroScrubPosterEnd = "/media/hero-glossy.webp";

/** Stiehle-style image-sequence film (desktop / mobile frame counts). */
export const heroFilmDesktopFrames = 128;
export const heroFilmMobileFrames = 128;
export const heroFilmBase = "/media/hero-film";

function pickHeroLoop(mobile: boolean) {
  const probe = document.createElement("video");
  const webm = probe.canPlayType('video/webm; codecs="vp9"') !== "";
  if (mobile) return webm ? "/media/hero-loop-720.webm" : "/media/hero-loop-720.mp4";
  return webm ? "/media/hero-loop.webm" : "/media/hero-loop.mp4";
}

function heroFilmPath(mobile: boolean, index: number) {
  const folder = mobile ? "m" : "d";
  const n = String(index + 1).padStart(4, "0");
  return `${heroFilmBase}/${folder}/${n}.webp`;
}

function HeroScrollScrub({
  alt,
  className,
  priority = false,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const stage = root.closest(".hero-stage") as HTMLElement | null;
    if (!stage) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const count = mobile ? heroFilmMobileFrames : heroFilmDesktopFrames;
    const frames: (HTMLImageElement | undefined)[] = new Array(count);
    let loaded = 0;
    let ist = 0;
    let soll = 0;
    let drawn = -1;
    let visible = true;
    let raf = 0;
    let stopped = false;

    const nearest = (i: number) => {
      if (frames[i]) return frames[i]!;
      for (let d = 1; d < count; d++) {
        if (frames[i - d]) return frames[i - d]!;
        if (frames[i + d]) return frames[i + d]!;
      }
      return null;
    };

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.5);
      const w = root.clientWidth;
      const h = root.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      drawn = -1;
    };

    const draw = (force = false) => {
      const i = Math.max(0, Math.min(count - 1, Math.round(ist)));
      const img = nearest(i);
      if (!img) return;
      if (!force && i === drawn) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      drawn = i;
    };

    const chapters = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-film-von]"),
    );
    const bars = Array.from(
      stage.querySelectorAll<HTMLElement>(".hero-film-progress b"),
    );
    const hint = stage.querySelector<HTMLElement>(".scroll-hint");
    const updateChrome = (p: number) => {
      for (const el of chapters) {
        const von = Number(el.dataset.filmVon);
        const bis = Number(el.dataset.filmBis);
        const local = (p - von) / Math.max(0.0001, bis - von);
        let opacity = 0;
        let y = 70;
        if (local > 0 && local < 1) {
          if (local < 0.22) {
            opacity = local / 0.22;
            y = 70 * (1 - opacity);
          } else if (local > 0.78) {
            opacity = (1 - local) / 0.22;
            y = -70 * (1 - opacity);
          } else {
            opacity = 1;
            y = 0;
          }
        } else if (local >= 1 && el.hasAttribute("data-film-stay")) {
          opacity = 1;
          y = 0;
        }
        opacity = opacity * opacity * (3 - 2 * opacity);
        el.style.opacity = opacity.toFixed(3);
        el.style.transform = `translate3d(-50%, calc(-50% + ${y.toFixed(1)}px), 0)`;
        el.classList.toggle("is-on", opacity > 0.45);
      }
      if (bars.length) {
        const share = 1 / bars.length;
        bars.forEach((b, i) => {
          const f = Math.max(0, Math.min(1, (p - i * share) / share));
          b.style.transform = `scaleY(${f.toFixed(3)})`;
        });
      }
      if (hint) hint.style.opacity = p > 0.03 ? "0" : "";
    };

    const measure = () => {
      const scrollable = Math.max(1, stage.offsetHeight - window.innerHeight);
      const top = stage.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, -top / scrollable));
      soll = p * (count - 1);
      stage.style.setProperty("--hero-scrub-p", p.toFixed(4));
      updateChrome(p);
      const r = stage.getBoundingClientRect();
      visible = r.bottom > 0 && r.top < window.innerHeight;
    };

    const tick = () => {
      if (stopped) return;
      if (visible) {
        const diff = soll - ist;
        ist = Math.abs(diff) < 0.02 ? soll : ist + diff * 0.28;
        draw(false);
      }
      raf = window.requestAnimationFrame(tick);
    };

    // Progressive load like Stiehle: coarse keyframes first
    const order: number[] = [];
    for (const step of [16, 8, 4, 2, 1]) {
      for (let i = 0; i < count; i += step) {
        if (!order.includes(i)) order.push(i);
      }
    }
    if (!order.includes(count - 1)) order.splice(1, 0, count - 1);

    let pos = 0;
    let active = 0;
    const maxConcurrent = 6;
    const pump = () => {
      while (active < maxConcurrent && pos < order.length) {
        const idx = order[pos++];
        active++;
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          frames[idx] = img;
          loaded++;
          active--;
          if (idx === 0 || drawn < 0) draw(true);
          const bar = stage.querySelector(".hero-film-load") as HTMLElement | null;
          if (bar) {
            bar.style.width = `${(loaded / count) * 100}%`;
            if (loaded >= count) bar.style.opacity = "0";
          }
          pump();
        };
        img.onerror = () => {
          active--;
          pump();
        };
        img.src = heroFilmPath(mobile, idx);
      }
    };

    sizeCanvas();
    measure();
    pump();
    raf = window.requestAnimationFrame(tick);

    const onScroll = () => measure();
    const onResize = () => {
      sizeCanvas();
      measure();
      draw(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      stage.style.removeProperty("--hero-scrub-p");
    };
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <div
        ref={rootRef}
        className={cn("hero-image relative isolate size-full overflow-hidden", className)}
      >
        <picture>
          <source type="image/webp" srcSet={heroScrubPosterEnd} />
          <img
            src="/media/hero-glossy.jpg"
            alt={alt}
            width={1920}
            height={1080}
            className="absolute inset-0 size-full object-cover"
            fetchPriority={priority ? "high" : "low"}
            decoding={priority ? "sync" : "async"}
            loading={priority ? "eager" : "lazy"}
          />
        </picture>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("hero-image hero-film relative isolate size-full overflow-hidden", className)}
    >
      <img
        src={heroScrubPosterStart}
        alt=""
        aria-hidden
        width={1280}
        height={720}
        className="absolute inset-0 size-full object-cover"
        fetchPriority={priority ? "high" : "low"}
        decoding="async"
      />
      <canvas
        ref={canvasRef}
        className="hero-film-canvas absolute inset-0 size-full"
        role="img"
        aria-label={alt}
      />
      <div className="hero-film-load" aria-hidden />
    </div>
  );
}

function HeroLoopMedia({
  alt,
  className,
  priority = false,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const syncPlayback = useRef<() => void>(() => {});
  const pausedRef = useRef(false);
  const videoId = useId();
  const [imageReady, setImageReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [controlHost, setControlHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setControlHost(
      containerRef.current?.closest<HTMLElement>(".hero-stage, .film-chapter") ?? null,
    );
  }, []);

  useEffect(() => {
    controlHost?.toggleAttribute("data-motion-paused", paused);
    return () => controlHost?.removeAttribute("data-motion-paused");
  }, [controlHost, paused]);

  useEffect(() => {
    if (!imageReady) return;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & {
        connection?: EventTarget & { saveData?: boolean };
      }
    ).connection;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    let visible = false;
    let disposed = false;
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const cancelStart = () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      idleId = undefined;
      timeoutId = undefined;
    };
    const canPlay = () =>
      !disposed &&
      visible &&
      !document.hidden &&
      !pausedRef.current &&
      !reducedMotion.matches &&
      !connection?.saveData;
    const start = () => {
      idleId = undefined;
      timeoutId = undefined;
      if (!canPlay()) return;
      // The media element owns the only request; no competing prefetch.
      if (!video.getAttribute("src")) video.src = pickHeroLoop(mobile);
      void video.play().catch(() => {
        // Autoplay restrictions leave the still image and an explicit play button.
        if (!disposed && canPlay()) {
          pausedRef.current = true;
          setPaused(true);
        }
      });
    };
    const update = () => {
      cancelStart();
      const allowed = !reducedMotion.matches && !connection?.saveData;
      setMotionAllowed(allowed);
      if (!canPlay()) {
        video.pause();
        if (!allowed) video.removeAttribute("data-ready");
        return;
      }
      // Keep the still image first, then start visible media when the main thread is idle.
      if (video.getAttribute("src")) start();
      else if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(start, { timeout: 1000 });
      } else {
        timeoutId = window.setTimeout(start, 0);
      }
    };
    syncPlayback.current = update;
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      update();
    });
    observer.observe(container);
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    connection?.addEventListener("change", update);
    update();
    return () => {
      disposed = true;
      cancelStart();
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
      syncPlayback.current = () => {};
      video.pause();
      if (video.getAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [imageReady]);

  const control = motionAllowed ? (
    <button
      type="button"
      aria-controls={videoId}
      className="absolute left-4 bottom-[calc(var(--consent-banner-height,0px)+1rem)] z-10 min-h-11 rounded-sm border border-white/60 bg-black px-3 text-xs text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      onClick={() => {
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
        syncPlayback.current();
      }}
    >
      {paused ? "Animation abspielen" : "Animation pausieren"}
    </button>
  ) : null;

  return (
    <div
      ref={containerRef}
      className={cn("hero-image relative isolate size-full overflow-hidden", className)}
      data-motion-paused={paused || undefined}
    >
      <picture>
        <source type="image/avif" srcSet={heroAvifSrcSet} sizes="100vw" />
        <source type="image/webp" srcSet={heroWebpSrcSet} sizes="100vw" />
        <img
          src="/media/hero-720.webp"
          alt={alt}
          width={1600}
          height={907}
          className="absolute inset-0 size-full object-cover"
          fetchPriority={priority ? "high" : "low"}
          decoding={priority ? "sync" : "async"}
          loading={priority ? "eager" : "lazy"}
          sizes="100vw"
          ref={(el) => {
            if (el?.complete) setImageReady(true);
          }}
          onLoad={() => setImageReady(true)}
        />
      </picture>
      <video
        ref={videoRef}
        id={videoId}
        aria-hidden="true"
        muted
        loop
        playsInline
        preload="none"
        className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 data-[ready]:opacity-100"
        onPlaying={(e) => e.currentTarget.setAttribute("data-ready", "")}
      />
      {controlHost ? createPortal(control, controlHost) : control}
    </div>
  );
}

export function HeroMedia({
  alt,
  className,
  priority = false,
  scrub = false,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
  /** Homepage: tall sticky section; video currentTime follows scroll. */
  scrub?: boolean;
}) {
  if (scrub) {
    return <HeroScrollScrub alt={alt} className={className} priority={priority} />;
  }
  return <HeroLoopMedia alt={alt} className={className} priority={priority} />;
}

export type ShotName =
  "keramik" | "lack" | "leder" | "felgen" | "hero" | "dellen" | "atelier" | "private" | "finish";

const SLOT_CLASS: Record<ShotName, string> = {
  hero: "hero-image",
  lack: "service-image-1",
  keramik: "service-image-2",
  felgen: "service-image-3",
  leder: "service-image-4",
  dellen: "before-after-1",
  atelier: "workshop-image",
  finish: "gallery-shot",
  private: "private-client-image",
};

const SHOT_SIZE: Record<ShotName, { w: number; h: number }> = {
  hero: { w: 1600, h: 907 },
  atelier: { w: 1200, h: 675 },
  private: { w: 1200, h: 675 },
  finish: { w: 1200, h: 800 },
  keramik: { w: 1200, h: 800 },
  lack: { w: 1200, h: 800 },
  leder: { w: 1200, h: 800 },
  felgen: { w: 1200, h: 800 },
  dellen: { w: 1200, h: 800 },
};

export function Shot({
  name,
  alt,
  className,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
  framed = true,
}: {
  name: ShotName;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  framed?: boolean;
}) {
  const frame = framed
    ? "group overflow-hidden outline outline-1 -outline-offset-1 outline-white/10"
    : "group overflow-hidden";
  const slotClass = SLOT_CLASS[name];
  if (name === "hero") {
    return (
      <div className={cn(frame, slotClass, className)}>
        <HeroMedia
          alt={alt}
          className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
          priority={priority}
        />
      </div>
    );
  }
  const { w, h } = SHOT_SIZE[name];
  const avif = `/media/${name}-480.avif 480w, /media/${name}-800.avif 800w, /media/${name}-1200.avif 1200w`;
  const webp = `/media/${name}-480.webp 480w, /media/${name}-800.webp 800w, /media/${name}-1200.webp 1200w`;
  return (
    <div className={cn(frame, slotClass, className)}>
      <picture>
        <source type="image/avif" srcSet={avif} sizes={sizes} />
        <source type="image/webp" srcSet={webp} sizes={sizes} />
        <img
          src={`/media/${name}-480.webp`}
          alt={alt}
          width={w}
          height={h}
          className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          sizes={sizes}
        />
      </picture>
    </div>
  );
}

export function FluidImg({
  src,
  alt,
  className,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const match = src.match(
    /\/media\/(hero|keramik|lack|leder|felgen|dellen|atelier|private|finish)/,
  );
  if (match) {
    return (
      <Shot
        name={match[1] as ShotName}
        alt={alt}
        className={className}
        priority={priority}
        sizes={sizes ?? "100vw"}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

const brandVariant = {
  header: {
    className: "h-14 w-auto sm:h-16",
    sizes: "(min-width: 640px) 111px, 97px",
    width: 176,
    height: 101,
    loading: "eager" as const,
    src: "/media/logo-176.webp",
  },
  footer: {
    className: "h-auto w-40 sm:w-48",
    sizes: "(min-width: 640px) 192px, 160px",
    width: 440,
    height: 253,
    loading: "lazy" as const,
    src: "/media/logo-440.webp",
  },
  auth: {
    className: "h-auto w-40",
    sizes: "160px",
    width: 280,
    height: 161,
    loading: "eager" as const,
    src: "/media/logo-280.webp",
  },
};

export function BrandMark({
  variant,
  decorative = false,
}: {
  variant: keyof typeof brandVariant;
  decorative?: boolean;
}) {
  const cfg = brandVariant[variant];
  return (
    <picture>
      <source type="image/avif" srcSet={logoAvifSrcSet} sizes={cfg.sizes} />
      <source type="image/webp" srcSet={logoWebpSrcSet} sizes={cfg.sizes} />
      <img
        src={cfg.src}
        alt={decorative ? "" : site.legalName}
        width={cfg.width}
        height={cfg.height}
        className={cn(
          cfg.className,
          "transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-80",
        )}
        loading={cfg.loading}
        decoding="async"
        fetchPriority="low"
        sizes={cfg.sizes}
      />
    </picture>
  );
}

export function PhotoNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-subtle", className)}>
      {atelierPhotos.caption} {atelierPhotos.invite}
    </p>
  );
}
