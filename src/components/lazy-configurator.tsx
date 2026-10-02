import { useRouterState } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { PackageId } from "@/data/site";
import { site } from "@/data/site";

const Configurator = lazy(() =>
  import("@/components/configurator").then((m) => ({ default: m.Configurator })),
);

function Skeleton() {
  return (
    <div className="gd-form min-h-[28rem]" role="status" aria-label="Buchungsformular wird geladen">
      <span className="sr-only">Buchungsformular wird geladen.</span>
      <div className="ga-fields rounded-card border border-line bg-surface" />
      <div className="ga-quote h-fit min-h-80 rounded-card border border-line bg-elevated" />
    </div>
  );
}

export function LazyConfigurator({
  eager = false,
  initialPackage,
  initialCity,
}: {
  eager?: boolean;
  initialPackage?: PackageId;
  initialCity?: string;
}) {
  const hash = useRouterState({ select: (s) => s.location.hash });
  const ref = useRef<HTMLDivElement>(null);
  // URL fragments are absent on the server; keep the initial client render identical.
  const [ready, setReady] = useState(eager);

  useEffect(() => {
    if (eager || hash === "buchung") setReady(true);
  }, [eager, hash]);

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
      <noscript>
        <style>{".lazy-configurator-js { display: none; }"}</style>
        <p className="mb-6 text-muted">
          Für Ihre Terminanfrage erreichen Sie uns telefonisch unter{" "}
          <a href={site.phoneHref} className="underline underline-offset-4">
            {site.phoneDisplay}
          </a>.
        </p>
      </noscript>
      <div className="lazy-configurator-js">
        {ready ? (
          <Suspense fallback={<Skeleton />}>
            <Configurator initialPackage={initialPackage} initialCity={initialCity} />
          </Suspense>
        ) : (
          <Skeleton />
        )}
      </div>
    </div>
  );
}
