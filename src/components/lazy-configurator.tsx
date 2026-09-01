import { useRouterState } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { PackageId } from "@/data/site";

const Configurator = lazy(() =>
  import("@/components/configurator").then((m) => ({ default: m.Configurator })),
);

function Skeleton() {
  return (
    <div
      className="gd-form min-h-[28rem]"
      role="status"
      aria-label="Buchungsformular wird geladen"
    >
      <div className="ga-fields rounded-card border border-line bg-surface" />
      <div className="ga-quote h-fit min-h-80 rounded-card border border-line bg-elevated" />
    </div>
  );
}

export function LazyConfigurator({
  eager = false,
  initialPackage,
}: {
  eager?: boolean;
  initialPackage?: PackageId;
}) {
  const hash = useRouterState({ select: (s) => s.location.hash });
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(eager || hash === "#buchung");

  useEffect(() => {
    if (hash === "#buchung") setReady(true);
  }, [hash]);

  useEffect(() => {
    if (ready) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          io.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready]);

  return (
    <div ref={ref}>
      {ready ? (
        <Suspense fallback={<Skeleton />}>
          <Configurator initialPackage={initialPackage} />
        </Suspense>
      ) : (
        <Skeleton />
      )}
    </div>
  );
}
