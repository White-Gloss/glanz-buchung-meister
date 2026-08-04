import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { company, features } from "@/lib/servicesConfig";

const NAV_LINK =
  "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
const ACTIVE_NAV = "bg-white/[0.05] text-foreground";
const MOBILE_NAV_LINK =
  "flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-sm text-foreground outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-ring";

type ServiceMenuProps = {
  id: string;
  mobile?: boolean;
  onNavigate: () => void;
};

function ServiceMenu({ id, mobile = false, onNavigate }: ServiceMenuProps) {
  return (
    <div
      id={id}
      className={
        mobile
          ? "grid gap-1 border-l border-border pl-3"
          : "metal-panel absolute left-0 top-[calc(100%+0.65rem)] z-10 grid w-80 gap-1 rounded-2xl p-2 shadow-2xl"
      }
    >
      <Link
        to="/leistungen"
        onClick={onNavigate}
        className="rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block font-medium">Alle Leistungen</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Übersicht, Ablauf und passende Pakete
        </span>
      </Link>
      {features.map((service) => (
        <Link
          key={service.slug}
          to="/leistungen/$service"
          params={{ service: service.slug }}
          onClick={onNavigate}
          className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {service.name}
        </Link>
      ))}
    </div>
  );
}

export function SiteHeader() {
  const [desktopServicesOpen, setDesktopServicesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const desktopServicesButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const anyMenuOpen = desktopServicesOpen || mobileOpen;

  const closeMenus = () => {
    setDesktopServicesOpen(false);
    setMobileOpen(false);
    setMobileServicesOpen(false);
  };

  useEffect(() => {
    if (!anyMenuOpen) return;

    const startViewportWidth = window.innerWidth;
    const closeWithoutFocus = () => {
      setDesktopServicesOpen(false);
      setMobileOpen(false);
      setMobileServicesOpen(false);
    };
    // Ein echter Klick schließt bei einer Aktion außerhalb. Reines
    // Scrollen/Wischen löst keinen Klick aus und lässt das Menü offen.
    const handleDocumentClick = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) closeWithoutFocus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const focusTarget = mobileOpen ? mobileButtonRef.current : desktopServicesButtonRef.current;
      closeWithoutFocus();
      focusTarget?.focus();
    };
    const handleResize = () => {
      // Mobile Browser verändern beim Scrollen häufig nur die Viewport-Höhe,
      // wenn die Adressleiste ein-/ausblendet. Das darf das Menü nicht schließen.
      if (window.innerWidth !== startViewportWidth) closeWithoutFocus();
    };

    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anyMenuOpen, mobileOpen]);

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-2xl"
      >
        <div className="mx-auto grid min-h-[4.75rem] max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="White Gloss Detailing – zur Startseite"
            onClick={closeMenus}
            className="flex min-h-11 min-w-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden className="flex shrink-0 flex-col items-center leading-none">
              <span className="font-display text-[1.65rem] uppercase tracking-[0.13em] text-foreground sm:text-[1.8rem]">
                White Gloss
              </span>
              <span className="mt-1 text-[0.5rem] font-medium uppercase tracking-[0.5em] text-primary sm:text-[0.54rem]">
                Detailing
              </span>
            </span>
          </Link>

          <nav aria-label="Hauptnavigation" className="hidden items-center gap-0.5 lg:flex">
            <div className="relative">
              <button
                ref={desktopServicesButtonRef}
                type="button"
                aria-expanded={desktopServicesOpen}
                aria-controls="desktop-service-menu"
                onClick={() => {
                  setDesktopServicesOpen((open) => !open);
                  setMobileOpen(false);
                  setMobileServicesOpen(false);
                }}
                className={`${NAV_LINK} cursor-pointer`}
              >
                Leistungen
                <ChevronDown
                  aria-hidden
                  className={`ml-1 size-3.5 transition-transform ${desktopServicesOpen ? "rotate-180" : ""}`}
                />
              </button>
              {desktopServicesOpen && (
                <ServiceMenu id="desktop-service-menu" onNavigate={closeMenus} />
              )}
            </div>
            <Link
              to="/preise"
              className={NAV_LINK}
              activeProps={{ className: ACTIVE_NAV }}
              onClick={closeMenus}
            >
              Preise
            </Link>
            <Link
              to="/qualitaet"
              className={NAV_LINK}
              activeProps={{ className: ACTIVE_NAV }}
              onClick={closeMenus}
            >
              Qualität
            </Link>
            <Link
              to="/abholservice"
              className={NAV_LINK}
              activeProps={{ className: ACTIVE_NAV }}
              onClick={closeMenus}
            >
              Abholservice
            </Link>
            <Link to="/" hash="b2b" className={NAV_LINK} onClick={closeMenus}>
              B2B &amp; Flotten
            </Link>
            <Button asChild size="sm" className="ml-2 rounded-lg px-5">
              <Link to="/" hash="buchung" onClick={closeMenus}>
                Termin anfragen
              </Link>
            </Button>
          </nav>

          <div className="relative lg:hidden">
            <button
              ref={mobileButtonRef}
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="mobile-main-menu"
              aria-label={mobileOpen ? "Navigation schließen" : "Navigation öffnen"}
              onClick={() => {
                setMobileOpen((open) => !open);
                setDesktopServicesOpen(false);
                if (mobileOpen) setMobileServicesOpen(false);
              }}
              className="grid size-11 place-items-center rounded-full border border-border bg-white/[0.03] text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {mobileOpen ? (
                <X aria-hidden className="size-5" />
              ) : (
                <Menu aria-hidden className="size-5" />
              )}
            </button>

            {mobileOpen && (
              <nav
                id="mobile-main-menu"
                aria-label="Mobile Navigation"
                className="metal-panel absolute right-0 top-[calc(100%+0.65rem)] grid max-h-[calc(100dvh-7rem)] w-[min(23rem,calc(100vw-2rem))] gap-1 overflow-y-auto rounded-2xl p-3 shadow-2xl"
              >
                <p className="px-4 pb-1 pt-2 text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Navigation
                </p>
                <Link
                  to="/"
                  activeOptions={{ exact: true }}
                  className={MOBILE_NAV_LINK}
                  onClick={closeMenus}
                >
                  Startseite
                </Link>
                <div>
                  <button
                    type="button"
                    aria-expanded={mobileServicesOpen}
                    aria-controls="mobile-service-menu"
                    onClick={() => setMobileServicesOpen((open) => !open)}
                    className={MOBILE_NAV_LINK}
                  >
                    Leistungen
                    <ChevronDown
                      aria-hidden
                      className={`size-3.5 transition-transform ${mobileServicesOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {mobileServicesOpen && (
                    <div className="px-4 pb-2">
                      <ServiceMenu id="mobile-service-menu" mobile onNavigate={closeMenus} />
                    </div>
                  )}
                </div>
                <Link to="/preise" className={MOBILE_NAV_LINK} onClick={closeMenus}>
                  Preise &amp; Pakete
                </Link>
                <Link to="/qualitaet" className={MOBILE_NAV_LINK} onClick={closeMenus}>
                  Qualitätsanspruch
                </Link>
                <Link to="/abholservice" className={MOBILE_NAV_LINK} onClick={closeMenus}>
                  Hol- &amp; Bringservice
                </Link>
                <Link to="/" hash="b2b" className={MOBILE_NAV_LINK} onClick={closeMenus}>
                  B2B &amp; Flottenkunden
                </Link>

                <div className="mt-2 border-t border-border px-1 pt-3">
                  <Button asChild className="w-full rounded-lg">
                    <Link to="/" hash="buchung" onClick={closeMenus}>
                      Termin anfragen
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  </Button>
                  <a
                    href={company.whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={closeMenus}
                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <MessageCircle aria-hidden className="size-4 text-primary" />
                    Per WhatsApp schreiben
                  </a>
                </div>
              </nav>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-primary/20 bg-primary/[0.07]">
        <div className="mx-auto grid min-h-10 max-w-7xl items-center gap-x-4 px-4 py-1.5 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <p className="hidden items-center gap-2 lg:inline-flex">
            <MapPin aria-hidden className="size-3.5 text-primary" />
            Horb am Neckar · Baden-Württemberg
          </p>
          <Link
            to="/"
            hash="b2b"
            className="group inline-flex min-h-8 items-center justify-center gap-2 rounded-sm text-center font-medium text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Building2 aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="sm:hidden">
              <span className="text-primary">B2B</span> · Angebot anfragen
            </span>
            <span className="hidden sm:inline">
              <span className="text-primary">B2B</span> · Flotten &amp; Leasingrückläufer
            </span>
            <span className="hidden text-muted-foreground xl:inline">Individuell kalkuliert</span>
            <ArrowRight
              aria-hidden
              className="size-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <div className="hidden items-center gap-5 lg:flex">
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
    </>
  );
}
