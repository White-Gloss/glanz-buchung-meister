import { Link } from "@tanstack/react-router";
import { ChevronDown, MapPin, Menu, MessageCircle, Phone } from "lucide-react";

import logoSm from "@/assets/wgd-logo-440.webp.asset.json";
import logoLg from "@/assets/wgd-logo-760.webp.asset.json";
import { Button } from "@/components/ui/button";
import { company, features } from "@/lib/servicesConfig";

const LOGO_SRCSET = `${logoSm.url} 440w, ${logoLg.url} 760w`;
const NAV_LINK =
  "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
const ACTIVE_NAV = "bg-white/[0.05] text-foreground";

function ServiceMenu({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      className={
        mobile
          ? "grid gap-1 border-l border-border pl-3"
          : "metal-panel absolute left-0 top-[calc(100%+0.75rem)] grid w-80 gap-1 rounded-2xl p-2 shadow-2xl"
      }
    >
      <Link
        to="/leistungen"
        className="rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block font-medium">Alle Leistungen</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Überblick, Ablauf und passende Pakete
        </span>
      </Link>
      {features.map((service) => (
        <Link
          key={service.slug}
          to="/leistungen/$service"
          params={{ service: service.slug }}
          className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {service.name}
        </Link>
      ))}
    </div>
  );
}

export function SiteHeader() {
  return (
    <>
      <div className="border-b border-border/70 bg-black/35">
        <div className="mx-auto flex min-h-9 max-w-7xl items-center justify-between gap-4 px-4 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground sm:px-6">
          <p className="inline-flex items-center gap-2">
            <MapPin aria-hidden className="size-3.5 text-primary" />
            Horb am Neckar · Baden-Württemberg
          </p>
          <div className="hidden items-center gap-5 sm:flex">
            <a
              href={company.phoneHref}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Phone aria-hidden className="size-3.5 text-primary" />
              {company.phone}
            </a>
            <a
              href={company.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <MessageCircle aria-hidden className="size-3.5 text-primary" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-2xl">
        <div className="mx-auto grid min-h-[4.75rem] max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="White Gloss Detailing – zur Startseite"
            className="flex min-h-11 min-w-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={logoSm.url}
              srcSet={LOGO_SRCSET}
              sizes="(min-width: 640px) 190px, 150px"
              width={440}
              height={253}
              decoding="async"
              alt="White Gloss Detailing"
              className="h-auto w-[150px] shrink-0 object-contain sm:w-[190px]"
            />
          </Link>

          <nav aria-label="Hauptnavigation" className="hidden items-center gap-0.5 lg:flex">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              className={NAV_LINK}
              activeProps={{ className: ACTIVE_NAV }}
            >
              Startseite
            </Link>
            <details className="group relative">
              <summary
                className={`${NAV_LINK} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
              >
                Leistungen
                <ChevronDown
                  aria-hidden
                  className="ml-1 size-3.5 transition-transform group-open:rotate-180"
                />
              </summary>
              <ServiceMenu />
            </details>
            <Link to="/preise" className={NAV_LINK} activeProps={{ className: ACTIVE_NAV }}>
              Preise
            </Link>
            <Link to="/qualitaet" className={NAV_LINK} activeProps={{ className: ACTIVE_NAV }}>
              Qualität
            </Link>
            <Link to="/abholservice" className={NAV_LINK} activeProps={{ className: ACTIVE_NAV }}>
              Abholservice
            </Link>
            <Button asChild size="sm" className="ml-2 rounded-full px-5">
              <Link to="/" hash="buchung">
                Termin anfragen
              </Link>
            </Button>
          </nav>

          <details className="group relative lg:hidden">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full border border-border bg-white/[0.03] text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden className="size-5" />
              <span className="sr-only">Navigation öffnen</span>
            </summary>
            <nav
              aria-label="Mobile Navigation"
              className="metal-panel absolute right-0 top-[calc(100%+0.75rem)] grid w-[min(22rem,calc(100vw-2rem))] gap-1 rounded-2xl p-3 shadow-2xl"
            >
              <Link to="/" activeOptions={{ exact: true }} className={NAV_LINK}>
                Startseite
              </Link>
              <details className="group/services">
                <summary
                  className={`${NAV_LINK} w-full cursor-pointer list-none justify-between [&::-webkit-details-marker]:hidden`}
                >
                  Leistungen
                  <ChevronDown
                    aria-hidden
                    className="size-3.5 transition-transform group-open/services:rotate-180"
                  />
                </summary>
                <div className="px-3 pb-2">
                  <ServiceMenu mobile />
                </div>
              </details>
              <Link to="/preise" className={NAV_LINK}>
                Preise
              </Link>
              <Link to="/qualitaet" className={NAV_LINK}>
                Qualität
              </Link>
              <Link to="/abholservice" className={NAV_LINK}>
                Abholservice
              </Link>
              <Button asChild className="mt-2 rounded-full">
                <Link to="/" hash="buchung">
                  Termin anfragen
                </Link>
              </Button>
              <a
                href={company.whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <MessageCircle aria-hidden className="size-4 text-primary" />
                Per WhatsApp schreiben
              </a>
            </nav>
          </details>
        </div>
      </header>
    </>
  );
}
