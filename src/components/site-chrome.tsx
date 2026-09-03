import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { nav, footerExplore, openingHours, site } from "@/data/site";
import { IconArrowRight, IconMessage } from "./icons";
import { BrandMark, Shot, type ShotName } from "./media";
import { ctaGhost, ctaPrimary } from "./ui";
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

const NAV_SHOT: Record<string, ShotName> = {
  Startseite: "atelier",
  Leistungen: "lack",
  Luxusfahrzeuge: "private",
  "Preise & Pakete": "finish",
  Qualitätsanspruch: "atelier",
  "Hol- & Bringservice": "felgen",
  "Individuelles Angebot": "keramik",
  Ratgeber: "dellen",
  "Häufige Fragen": "atelier",
  Werkstatt: "atelier",
  Kontakt: "finish",
  B2B: "private",
};

const MENU_SHOTS: ShotName[] = [
  "lack",
  "private",
  "finish",
  "atelier",
  "felgen",
  "keramik",
  "dellen",
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    if (open) {
      setLayer(true);
      return;
    }
    if (!layer) return;
    const t = window.setTimeout(() => setLayer(false), 420);
    return () => window.clearTimeout(t);
  }, [open, layer]);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 80);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = document.getElementById("site-nav");
      const toggle = document.querySelector<HTMLElement>(".menu-toggle");
      if (!root) return;
      const focusable = [
        toggle,
        ...root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el): el is HTMLElement =>
        Boolean(el && !el.hasAttribute("disabled") && el.tabIndex !== -1),
      );
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
    window.addEventListener("keydown", onKey);
    const t = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#site-nav .film-menu-link")?.focus();
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(t);
    };
  }, [open]);

  useEffect(() => {
    if (!layer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.nav = "open";
    return () => {
      document.body.style.overflow = prev;
      delete document.body.dataset.nav;
    };
  }, [layer]);

  return (
    <header
      className={`site-header ${layer ? "z-[110]" : "z-40"}`}
      data-scrolled={scrolled ? "true" : "false"}
      data-nav-open={layer ? "true" : "false"}
    >
      <div className="gd-header mx-auto max-w-7xl px-4 sm:px-6 xl:max-w-[90rem] xl:px-10">
        <Link
          to="/"
          className="ga-logo group inline-flex min-h-11 items-center"
          aria-label={`${site.name} Startseite`}
        >
          <BrandMark variant="header" decorative />
        </Link>
        <div className="ga-tools flex items-center">
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="site-nav"
            aria-haspopup="dialog"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="burger" aria-hidden>
              <span className="burger-line" />
              <span className="burger-line" />
              <span className="burger-line" />
            </span>
          </button>
        </div>
      </div>
      {layer ? (
        <FilmMenu
          closing={!open}
          onClose={() => {
            window.setTimeout(() => setOpen(false), 0);
          }}
        />
      ) : null}
    </header>
  );
}

function FilmMenu({
  onClose,
  closing,
}: {
  onClose: () => void;
  closing: boolean;
}) {
  const [visual, setVisual] = useState<ShotName>("private");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (typeof document === "undefined") return null;

  const items = [{ to: "/", label: "Startseite" as const }, ...nav];

  return createPortal(
    <nav
      id="site-nav"
      role="dialog"
      aria-modal="true"
      aria-label="Hauptnavigation"
      className={closing ? "film-menu is-closing" : "film-menu"}
      aria-hidden={closing || undefined}
    >
      <div className="film-menu-visual" aria-hidden>
        {MENU_SHOTS.map((name) => (
          <Shot
            key={name}
            name={name}
            alt=""
            framed={false}
            className={`film-menu-shot${name === visual ? " is-on" : ""}`}
            sizes="50vw"
          />
        ))}
      </div>
      <div className="film-menu-panel">
        <ul className="film-menu-list">
          {items.map((item, i) => {
            const shot = NAV_SHOT[item.label] ?? "hero";
            const current =
              "hash" in item && item.hash
                ? false
                : item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <li key={item.label} style={{ ["--i" as string]: i }}>
                {"hash" in item && item.hash ? (
                  <Link
                    to={item.to}
                    hash={item.hash}
                    className="film-menu-link"
                    onClick={onClose}
                    onMouseEnter={() => setVisual(shot)}
                    onFocus={() => setVisual(shot)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <Link
                    to={item.to}
                    className="film-menu-link"
                    aria-current={current ? "page" : undefined}
                    onClick={onClose}
                    onMouseEnter={() => setVisual(shot)}
                    onFocus={() => setVisual(shot)}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        <div className="film-menu-cta">
          <Link to="/" hash="buchung" className={ctaPrimary} onClick={onClose}>
            Termin anfragen
            <IconArrowRight className="size-4" />
          </Link>
          <a
            href={site.whatsapp}
            className={ctaGhost}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconMessage className="size-4" />
            WhatsApp
          </a>
        </div>
      </div>
    </nav>,
    document.body,
  );
}

function FilmScroll() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const reveals = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }
      },
      { threshold: 0.06, rootMargin: "22% 0px -6% 0px" },
    );

    const start = window.requestAnimationFrame(() => {
      reveals.forEach((el) => io.observe(el));
      if (reduce) reveals.forEach((el) => el.classList.add("is-in"));
    });

    const skipParallax =
      reduce || window.matchMedia("(max-width: 767px), (hover: none)").matches;

    if (skipParallax) {
      root.style.removeProperty("--scroll-p");
      return () => {
        window.cancelAnimationFrame(start);
        io.disconnect();
      };
    }

    let frame = 0;
    const tick = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const raw = Math.min(1, Math.max(0, window.scrollY / vh));
      const p = raw * raw * (3 - 2 * raw);
      root.style.setProperty("--scroll-p", p.toFixed(4));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(start);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--scroll-p");
    };
  }, [pathname]);

  return null;
}

export function SiteFooter() {
  return (
    <footer className="bg-bg">
      <div className="chrome-rule" aria-hidden />
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
          <p className="kicker">Leistungen</p>
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
                params={{ slug: "innenraumreinigung" }}
                className="link-draw inline-flex min-h-11 items-center hover:text-fg"
              >
                Interior Gloss
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
          <p className="kicker">Studio</p>
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
          <p className="kicker">Rechtliches</p>
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
              <Link
                to="/barrierefreiheit"
                className="link-draw inline-flex min-h-11 items-center hover:text-fg"
              >
                Barrierefreiheit
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
      <p className="border-t border-line px-4 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {site.legalName}. Alle Rechte vorbehalten.
      </p>
    </footer>
  );
}

export function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isApp = pathname.startsWith("/admin") || pathname.startsWith("/login");

  if (isApp) {
    return (
      <div className="relative min-h-dvh bg-bg font-sans text-fg" data-shell="app">
        <SkipLink />
        <Outlet />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-bg font-sans text-fg" data-shell="public">
      <SkipLink />
      <SiteHeader />
      <FilmScroll />
      <Outlet />
      <SiteFooter />
      <WhatsAppFloat />
    </div>
  );
}
