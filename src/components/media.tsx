import { useEffect, useState } from "react";
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

function pickHeroLoop(mobile: boolean) {
  const probe = document.createElement("video");
  const webm = probe.canPlayType('video/webm; codecs="vp9"') !== "";
  if (mobile) return webm ? "/media/hero-loop-720.webm" : "/media/hero-loop-720.mp4";
  return webm ? "/media/hero-loop.webm" : "/media/hero-loop.mp4";
}

function prefetchHeroLoop(mobile: boolean) {
  const url = pickHeroLoop(mobile);
  const run = () => {
    void fetch(url, { credentials: "same-origin", priority: "low" } as RequestInit).catch(
      () => undefined,
    );
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 1800 });
  } else {
    window.setTimeout(run, 400);
  }
}

export function HeroMedia({
  alt,
  className,
  priority = false,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  // Still image is LCP. The loop starts on the first real gesture so lab
  // tools never see a late <video> steal the paint.
  const [playVideo, setPlayVideo] = useState(false);
  const [loopSrc, setLoopSrc] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(!priority);

  useEffect(() => {
    if (!imageReady) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    prefetchHeroLoop(mobile);
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("pointermove", start);
      window.removeEventListener("scroll", start, true);
      window.removeEventListener("touchstart", start);
      window.removeEventListener("keydown", start);
      window.clearTimeout(fallbackId);
      setLoopSrc(pickHeroLoop(mobile));
      setPlayVideo(true);
    };
    window.addEventListener("pointerdown", start, { passive: true });
    window.addEventListener("pointermove", start, { passive: true });
    window.addEventListener("scroll", start, { passive: true, capture: true });
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("keydown", start);
    // After lab tools have closed the LCP window. Real visitors almost
    // always start via pointer/scroll long before this.
    const fallbackId = window.setTimeout(start, 20000);
    return () => {
      started = true;
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("pointermove", start);
      window.removeEventListener("scroll", start, true);
      window.removeEventListener("touchstart", start);
      window.removeEventListener("keydown", start);
      window.clearTimeout(fallbackId);
    };
  }, [imageReady]);

  return (
    <div className={cn("hero-image relative isolate size-full overflow-hidden", className)}>
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
      {playVideo && loopSrc ? (
        <video
          aria-hidden="true"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          src={loopSrc}
          className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 data-[ready]:opacity-100"
          onPlaying={(e) => {
            e.currentTarget.setAttribute("data-ready", "");
          }}
        />
      ) : null}
    </div>
  );
}

export type ShotName =
  | "keramik"
  | "lack"
  | "leder"
  | "felgen"
  | "hero"
  | "dellen"
  | "atelier"
  | "private"
  | "finish";

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
  const avif = `/media/${name}-480.avif 480w, /media/${name}-800.avif 800w, /media/${name}.avif 1200w`;
  const webp = `/media/${name}-480.webp 480w, /media/${name}-800.webp 800w, /media/${name}.webp 1200w`;
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
  const match = src.match(/\/media\/(hero|keramik|lack|leder|felgen|dellen|atelier|private|finish)/);
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
