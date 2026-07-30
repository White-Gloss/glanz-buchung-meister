import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import logoSm from "@/assets/wgd-logo-440.webp.asset.json";
import logoLg from "@/assets/wgd-logo-760.webp.asset.json";

const LOGO_SRCSET = `${logoSm.url} 440w, ${logoLg.url} 760w`;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link
          to="/"
          aria-label="White Gloss Detailing – zur Startseite"
          className="flex min-h-11 min-w-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={logoSm.url}
            srcSet={LOGO_SRCSET}
            sizes="(min-width: 640px) 220px, 160px"
            width={440}
            height={253}
            decoding="async"
            alt=""
            aria-hidden
            className="h-10 w-auto max-w-[160px] shrink-0 object-contain sm:h-13 sm:max-w-[220px] lg:h-15"
          />
        </Link>

        <nav aria-label="Hauptnavigation" className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            to="/"
            hash="leistungen"
            className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:flex"
          >
            Leistungen
          </Link>
          <Link
            to="/abholservice"
            className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          >
            Abholservice
          </Link>
          <Button asChild size="sm">
            <Link to="/" hash="buchung">
              Termin anfragen
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
