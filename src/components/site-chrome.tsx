import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Gem, Menu, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useId, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { nav, footerExplore, openingHours, services, sheetPrimary, sheetSecondary, site } from "@/data/site";
import { BrandMark } from "./media";
import { Button, ctaGhost, ctaPrimary } from "./ui";
import { cn } from "@/lib/utils";
import { WhatsAppFloat } from "./whatsapp-float";

export function SkipLink() {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById("main-content");
    if (!main) return;
    e.preventDefault();
    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: false });
    main.scrollIntoView({ block: "start" });
  }

  return (
    <a
      href="#main-content"
      onClick={onClick}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg"
    >
      Zum Inhalt springen
    </a>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
    setSvcOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = document.getElementById("mobile-nav");
      if (!root) return;
      const focusable = [
        ...root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.nav = "open";
    window.addEventListener("keydown", onKey);
    const t = window.requestAnimationFrame(() => {
      document.getElementById("mobile-nav-close")?.focus();
    });
    return () => {
      document.body.style.overflow = prev;
      delete document.body.dataset.nav;
      window.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(t);
    };
  }, [open]);

  return (
    <header className={`sticky top-0 border-b border-white/8 bg-bg ${open ? "z-[90]" : "z-40"}`}>
      <div className="gd-header mx-auto max-w-7xl px-4 py-3 sm:px-6 xl:max-w-[90rem] xl:px-10 2xl:max-w-[96rem]">
        <Link
          to="/"
          className="ga-logo group inline-flex min-h-11 items-center"
          aria-label={`${site.name} Startseite`}
        >
          <BrandMark variant="header" decorative />
        </Link>
        <nav className="ga-nav hidden items-center lg:flex" aria-label="Hauptnavigation">
          {nav.map((item) =>
            item.to === "/leistungen" ? (
              <div key={item.to} className="group/mega relative">
                <Link
                  to={item.to}
                  className="nav-link text-muted transition-colors duration-200 hover:text-fg"
                  activeProps={{
                    className: "nav-link text-fg",
                    "aria-current": "page",
                  }}
                >
                  {item.label}
                </Link>
                <div className="invisible absolute left-0 top-full z-50 min-w-[18rem] pt-3 opacity-0 transition-[opacity,visibility] duration-200 group-hover/mega:visible group-hover/mega:opacity-100 group-focus-within/mega:visible group-focus-within/mega:opacity-100">
                  <div className="rounded-2xl border border-white/10 bg-bg py-2 shadow-[var(--shadow-glow)]">
                    {services.map((s) => (
                      <Link
                        key={s.slug}
                        to="/leistungen/$slug"
                        params={{ slug: s.slug }}
                        className="block px-5 py-2.5 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-fg"
                      >
                        {s.nav}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className="nav-link text-muted transition-colors duration-200 hover:text-fg"
                activeProps={{
                  className: "nav-link text-fg",
                  "aria-current": "page",
                }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="ga-tools flex items-center gap-2">
          <a
            href={site.phoneHref}
            className="hidden min-h-11 items-center gap-2 px-1 text-[0.8rem] tracking-[0.04em] text-muted transition-colors duration-200 hover:text-fg lg:inline-flex"
            aria-label={`Anrufen ${site.phoneDisplay}`}
          >
            <Phone className="size-3.5" aria-hidden />
            {site.phoneDisplay}
          </a>
          <a
            href={site.whatsapp}
            className="hidden size-11 items-center justify-center rounded-full text-muted transition-colors hover:text-fg lg:inline-flex"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp mit White Gloss"
          >
            <MessageCircle className="size-4" aria-hidden />
          </a>
          <Link
            to="/"
            hash="buchung"
            className={cn(ctaPrimary, "max-lg:!hidden px-5")}
          >
            Termin anfragen
          </Link>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 text-fg lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-haspopup="dialog"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      {open ? (
        <MobileSheet
          svcOpen={svcOpen}
          setSvcOpen={setSvcOpen}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </header>
  );
}

function MobileSheet({
  svcOpen,
  setSvcOpen,
  onClose,
}: {
  svcOpen: boolean;
  setSvcOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="lg:hidden">
      <div
        className="fixed inset-x-0 bottom-0 z-[70] bg-black/60"
        style={{ top: "3.75rem" }}
        onClick={onClose}
      />
      <nav
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
        className="mobile-sheet z-[80]"
      >
        <div className="sheet-head">
          <p id="mobile-nav-title">Navigation</p>
          <button
            type="button"
            id="mobile-nav-close"
            className="sheet-close"
            aria-label="Menü schließen"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <ul className="sheet-list">
          <li>
            <Link to="/" className="nav-bubble" onClick={onClose}>
              Startseite
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="nav-bubble"
              aria-expanded={svcOpen}
              onClick={() => setSvcOpen((v) => !v)}
            >
              Leistungen
              <ChevronDown
                className={`ml-auto size-4 shrink-0 text-subtle transition-transform duration-200 ${svcOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {svcOpen ? (
              <ul className="sheet-sub">
                {services.map((s) => (
                  <li key={s.slug}>
                    <Link
                      to="/leistungen/$slug"
                      params={{ slug: s.slug }}
                      onClick={onClose}
                    >
                      {s.nav}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
          <li>
            <Link
              to="/luxusfahrzeuge"
              aria-label="Luxusfahrzeuge, nur auf Anruf"
              className="nav-bubble nav-bubble-featured"
              onClick={onClose}
            >
              <span className="nav-bubble-label">
                <Gem className="size-4 shrink-0 text-subtle" aria-hidden />
                Luxusfahrzeuge
              </span>
              <span className="nav-bubble-badge">Nur auf Anruf</span>
            </Link>
          </li>
          {sheetPrimary.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="nav-bubble" onClick={onClose}>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/" hash="buchung" className="nav-bubble" onClick={onClose}>
              Individuelles Angebot
            </Link>
          </li>
          {sheetSecondary.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="nav-bubble" onClick={onClose}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="nav-actions">
          <Link
            to="/"
            hash="buchung"
            className={`${ctaPrimary} h-12 w-full`}
            onClick={onClose}
          >
            Termin anfragen
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <a
            href={site.whatsapp}
            className={`${ctaGhost} h-12 w-full`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4" aria-hidden />
            Per WhatsApp schreiben
          </a>
        </div>
      </nav>
    </div>,
    document.body,
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="gd-footer mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="ga-brand">
          <Link
            to="/"
            className="inline-block"
            aria-label={`${site.name} Startseite`}
          >
            <BrandMark variant="footer" decorative />
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Fahrzeugaufbereitung in {site.city}: Innenraumreinigung,
            Lackkorrektur und Keramikversiegelung, mit Hol- und Bringservice in
            13 Städten.
          </p>
          <address className="mt-4 not-italic text-sm text-muted" aria-label="Anschrift">
            {site.legalName}
            <br />
            {site.owner}
            <br />
            {site.street}
            <br />
            {site.postalCode} {site.city}
          </address>
          <p className="mt-3 text-sm text-muted">
            <span className="text-fg">Öffnungszeiten</span>
            <br />
            {openingHours.daysLabel} {openingHours.opens}–{openingHours.closes} Uhr
          </p>
          <a
            href={site.phoneHref}
            className="mt-3 inline-block min-h-11 py-2 text-sm text-fg"
            aria-label={`Anrufen ${site.phoneDisplay}`}
          >
            {site.phoneDisplay}
          </a>
          <br />
          <a href={`mailto:${site.email}`} className="text-sm text-fg">
            {site.email}
          </a>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={site.phoneHref} className={ctaPrimary} aria-label={`Anrufen ${site.phoneDisplay}`}>
              Anrufen
            </a>
            <a
              href={site.whatsapp}
              className={ctaGhost}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
        <nav aria-label="Leistungen" className="ga-leistungen">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Leistungen</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link
                to="/leistungen/$slug"
                params={{ slug: "keramikversiegelung" }}
                className="link-draw inline-flex min-h-11 items-center hover:text-fg"
              >
                Ceramic Gloss
              </Link>
            </li>
            <li>
              <Link
                to="/leistungen/$slug"
                params={{ slug: "lackkorrektur" }}
                className="link-draw inline-flex min-h-11 items-center hover:text-fg"
              >
                Lackatelier
              </Link>
            </li>
            <li>
              <Link
                to="/leistungen/$slug"
                params={{ slug: "lederreparatur" }}
                className="link-draw inline-flex min-h-11 items-center hover:text-fg"
              >
                Lederrestauration
              </Link>
            </li>
            <li>
              <Link to="/preise" className="link-draw inline-flex min-h-11 items-center hover:text-fg">
                Preise
              </Link>
            </li>
            <li>
              <Link to="/luxusfahrzeuge" className="link-draw inline-flex min-h-11 items-center hover:text-fg">
                Luxus
              </Link>
            </li>
            <li>
              <Link to="/b2b" className="link-draw inline-flex min-h-11 items-center hover:text-fg">
                B2B
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Studio" className="ga-studio">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Studio</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {footerExplore.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="link-draw inline-flex min-h-11 items-center hover:text-fg">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Rechtliches" className="ga-recht">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Rechtliches</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link to="/impressum" className="link-draw inline-flex min-h-11 items-center hover:text-fg">
                Impressum
              </Link>
            </li>
            <li>
              <Link to="/datenschutz" className="link-draw inline-flex min-h-11 items-center hover:text-fg">
                Datenschutz
              </Link>
            </li>
            <li>
              <Link to="/agb" className="link-draw inline-flex min-h-11 items-center hover:text-fg">
                AGB
              </Link>
            </li>
            <li>
              <Link to="/widerruf" className="link-draw inline-flex min-h-11 items-center hover:text-fg">
                Widerruf
              </Link>
            </li>
            <li>
              <a
                href={site.instagram}
                className="link-draw inline-flex min-h-11 items-center hover:text-fg"
                rel="noopener noreferrer"
                target="_blank"
                aria-label="White Gloss auf Instagram, öffnet in neuem Tab"
              >
                Instagram
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-line px-4 py-4 text-center text-xs text-subtle">
        © {new Date().getFullYear()} {site.legalName}. Alle Rechte vorbehalten.
      </p>
    </footer>
  );
}

export function CookieNotice() {
  const [visible, setVisible] = useState(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    try {
      setVisible(localStorage.getItem("wg-cookie") !== "ok");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-xl rounded-lg border border-line bg-elevated p-4 shadow-lg sm:bottom-6"
    >
      <p id={titleId} className="text-sm font-medium text-fg">
        Technisch notwendige Speicherung
      </p>
      <p id={descId} className="mt-2 text-sm leading-relaxed text-muted">
        Diese Seite setzt nur technisch notwendige Speicherung ein. Es gibt kein
        Marketing-Tracking.
      </p>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem("wg-cookie", "ok");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          Verstanden
        </Button>
      </div>
    </div>
  );
}

export function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isApp = pathname.startsWith("/admin") || pathname.startsWith("/login");

  if (isApp) {
    return (
      <div className="relative min-h-dvh bg-bg font-sans text-fg">
        <SkipLink />
        <Outlet />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-bg font-sans text-fg">
      <SkipLink />
      <SiteHeader />
      <Outlet />
      <SiteFooter />
      <WhatsAppFloat />
      <CookieNotice />
    </div>
  );
}
