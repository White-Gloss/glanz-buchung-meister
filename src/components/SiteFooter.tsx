import { Link } from "@tanstack/react-router";
import { Mail, MapPin } from "lucide-react";
import logoSm from "@/assets/wgd-logo-440.webp.asset.json";
import { company } from "@/lib/servicesConfig";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <img
            src={logoSm.url}
            width={440}
            height={253}
            loading="lazy"
            decoding="async"
            alt=""
            aria-hidden
            className="h-12 w-auto"
          />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            {company.name} – {company.claim}
          </p>
        </div>

        <nav aria-label="Schnellzugriff" className="space-y-2 text-sm text-muted-foreground">
          <h2 className="label-caps text-foreground">Schnellzugriff</h2>
          <p>
            <Link to="/" className="transition-colors hover:text-foreground">
              Startseite
            </Link>
          </p>
          <p>
            <Link to="/" hash="leistungen" className="transition-colors hover:text-foreground">
              Leistungen &amp; Pakete
            </Link>
          </p>
          <p>
            <Link to="/abholservice" className="transition-colors hover:text-foreground">
              Abholservice
            </Link>
          </p>
          <p>
            <Link to="/" hash="buchung" className="transition-colors hover:text-foreground">
              Termin anfragen
            </Link>
          </p>
        </nav>

        <address className="space-y-3 text-sm not-italic text-muted-foreground">
          <h2 className="label-caps text-foreground">Kontakt</h2>
          <a
            href={`mailto:${company.email}`}
            className="flex min-h-11 items-center gap-2 transition-colors hover:text-foreground"
          >
            <Mail aria-hidden className="size-4 shrink-0 text-primary" />
            {company.email}
          </a>
          <p className="flex items-center gap-2">
            <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
            Horb am Neckar · Baden-Württemberg
          </p>
        </address>
      </div>

      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {company.name}. Alle Rechte vorbehalten.
      </div>
    </footer>
  );
}
