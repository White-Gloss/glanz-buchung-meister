import { lazy, Suspense, useEffect, useRef, useState } from "react";

const BeforeAfterSlider = lazy(() =>
  import("@/components/before-after-slider").then((m) => ({ default: m.BeforeAfterSlider })),
);

function Skeleton() {
  return (
    <div
      className="aspect-[16/10] w-full animate-pulse rounded-card border border-line bg-surface sm:aspect-[16/9]"
      role="status"
      aria-label="Lackvergleich wird geladen"
    />
  );
}

/** Defers the interactive comparison slider until near viewport (homepage gallery). */
export function LazyBeforeAfterSlider() {
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
      { rootMargin: "280px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready]);

  return (
    <div ref={ref}>
      {ready ? (
        <Suspense fallback={<Skeleton />}>
          <BeforeAfterSlider />
        </Suspense>
      ) : (
        <Skeleton />
      )}
    </div>
  );
}
