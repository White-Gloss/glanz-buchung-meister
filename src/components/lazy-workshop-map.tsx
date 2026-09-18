import { lazy, Suspense, useEffect, useRef, useState } from "react";

const WorkshopMap = lazy(() =>
  import("@/components/workshop-map").then((m) => ({ default: m.WorkshopMap })),
);

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div
        className="workshop-map flex min-h-[18rem] items-center justify-center border border-line bg-surface sm:min-h-[26rem]"
        role="status"
        aria-label="Standortkarte wird geladen"
      >
        <div className="h-4 w-40 animate-pulse rounded-sm bg-line" />
      </div>
    </div>
  );
}

/** Defers workshop map UI until near viewport — keeps Maps consent out of the index bundle. */
export function LazyWorkshopMap({ className = "" }: { className?: string }) {
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
    <div ref={ref}>
      {ready ? (
        <Suspense fallback={<Skeleton className={className} />}>
          <WorkshopMap className={className} />
        </Suspense>
      ) : (
        <Skeleton className={className} />
      )}
    </div>
  );
}
