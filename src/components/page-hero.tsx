import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FluidImg, Shot, type ShotName } from "./media";
import { cn } from "@/lib/utils";

export function PageCrumbs({
  items,
}: {
  items: { label: string; to?: string }[];
}) {
  return (
    <nav
      aria-label="Brotkrumen"
      className="text-[0.65rem] uppercase tracking-[0.18em] text-subtle"
    >
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 ? <span className="px-2 opacity-50">/</span> : null}
          {item.to ? (
            <Link to={item.to as never} className="hover:text-fg">
              {item.label}
            </Link>
          ) : (
            <span className="text-muted">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHero({
  kicker,
  title,
  lead,
  shot,
  src,
  alt,
  priority = true,
  actions,
  crumbs,
}: {
  kicker?: string;
  title: string;
  lead?: string;
  shot?: ShotName;
  src?: string;
  alt: string;
  priority?: boolean;
  actions?: ReactNode;
  crumbs?: { label: string; to?: string }[];
}) {
  return (
    <section className="film-chapter">
      <div className="film-chapter-media" data-parallax>
        {shot ? (
          <Shot
            name={shot}
            alt={alt}
            priority={priority}
            framed={false}
            className="size-full"
            sizes="100vw"
          />
        ) : (
          <FluidImg
            src={src ?? "/media/hero.webp"}
            alt={alt}
            priority={priority}
            className="size-full object-cover"
            sizes="100vw"
          />
        )}
      </div>
      <div className="film-chapter-veil" />
      <div className="film-chapter-copy" data-reveal>
        {crumbs ? <PageCrumbs items={crumbs} /> : null}
        {kicker ? (
          <p className={cn("kicker", crumbs ? "mt-5" : undefined)}>{kicker}</p>
        ) : null}
        <h1 className="heading-page mt-4 max-w-4xl">{title}</h1>
        {lead ? (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {lead}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

export function MediaTile({
  shot,
  src,
  alt,
  children,
  className,
}: {
  shot?: ShotName;
  src?: string;
  alt: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative min-h-[22rem] overflow-hidden sm:min-h-[26rem]",
        className,
      )}
    >
      {shot ? (
        <Shot
          name={shot}
          alt={alt}
          framed={false}
          className="absolute inset-0 h-full w-full"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
      ) : (
        <FluidImg
          src={src ?? "/media/atelier.webp"}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">{children}</div>
    </div>
  );
}
