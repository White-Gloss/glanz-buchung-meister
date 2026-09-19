import { lazy, Suspense, useEffect, useRef, useState } from "react";

const GoogleReviews = lazy(() =>
  import("@/components/google-reviews").then((m) => ({ default: m.GoogleReviews })),
);

function CompactSkeleton() {
  return (
    <div
      role="status"
      aria-label="Google-Kundenbewertungen werden geladen"
      className="mt-8 border-y border-line py-5"
    >
      <div className="h-6 w-64 max-w-full animate-pulse rounded-sm bg-line" />
      <div className="mt-2 h-4 w-48 max-w-full animate-pulse rounded-sm bg-line" />
    </div>
  );
}

/**
 * Defers the reviews chunk (and @tanstack/react-query) until near viewport.
 * Keeps the homepage main bundle free of unused review UI JS.
 */
export function LazyGoogleReviews({
  compact = false,
  id,
}: {
  compact?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || ready) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          io.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready]);

  return (
    <div id={id} ref={ref} className={id ? "scroll-mt-24" : undefined}>
      {ready ? (
        <Suspense fallback={compact ? <CompactSkeleton /> : null}>
          <GoogleReviews compact={compact} />
        </Suspense>
      ) : compact ? (
        <CompactSkeleton />
      ) : (
        <div className="section mx-auto max-w-7xl px-4 sm:px-6" aria-hidden />
      )}
    </div>
  );
}
