import { Link } from "@tanstack/react-router";
import { Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { company, features } from "@/lib/servicesConfig";

const FOOTER_LINK =
  "inline-flex min-h-8 items-center text-sm text-muted-foreground transition-colors hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[#06080a]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.25fr_0.8fr_0.8fr_1fr]">
        <div>
          <img
            src="/wgd-logo-440.webp"
            width={440}
            height={253}
            loading="lazy"
            decoding="async"
            alt="White Gloss Detailing"
            className="h-auto w-48"
          />
          <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
            Premium-Fahrzeugaufbereitung in Horb am Neckar – von der materialgerechten
            Innenreinigung bis zur langfristigen Keramikversiegelung.
          </p>
          <p className="mt-5 text-xs uppercase tracking-[0.18em] text-primary">{company.claim}</p>
        </div>

        <nav aria-label="Unternehmen" className="space-y-1">
          <h2 className="label-caps mb-3 text-foreground">Unternehmen</h2>
          <p>
            <Link to="/" className={FOOTER_LINK}>
              Startseite
            </Link>
          </p>
          <p>
            <Link to="/leistungen" className={FOOTER_LINK}>
              Leistungen
            </Link>
          </p>
          <p>
            <Link to="/preise" className={FOOTER_LINK}>
              Preise &amp; Pakete
            </Link>
          </p>
          <p>
            <Link to="/qualitaet" className={FOOTER_LINK}>
              Unser Qualitätsanspruch
            </Link>
          </p>
          <p>
            <Link to="/abholservice" className={FOOTER_LINK}>
              Abholservice
            </Link>
          </p>
          <p>
            <Link to="/" hash="b2b" className={FOOTER_LINK}>
              B2B &amp; Flottenkunden
            </Link>
          </p>
          <p>
            <Link to="/ratgeber" className={FOOTER_LINK}>
              Ratgeber
            </Link>
          </p>
          <p>
            <Link to="/faq" className={FOOTER_LINK}>
              Häufige Fragen
            </Link>
          </p>
        </nav>

        <nav aria-label="Leistungen" className="space-y-1">
          <h2 className="label-caps mb-3 text-foreground">Leistungen</h2>
          {features.map((service) => (
            <p key={service.slug}>
              <Link
                to="/leistungen/$service"
                params={{ service: service.slug }}
                className={FOOTER_LINK}
              >
                {service.name}
              </Link>
            </p>
          ))}
        </nav>

        <address className="space-y-2 not-italic">
          <h2 className="label-caps mb-3 text-foreground">Kontakt</h2>
          <a href={company.phoneHref} className={`${FOOTER_LINK} gap-2`}>
            <Phone aria-hidden className="size-4 shrink-0 text-primary" />
            {company.phone}
          </a>
          <a
            href={company.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={`${FOOTER_LINK} gap-2`}
          >
            <MessageCircle aria-hidden className="size-4 shrink-0 text-primary" />
            WhatsApp
          </a>
          <a href={`mailto:${company.email}`} className={`${FOOTER_LINK} gap-2`}>
            <Mail aria-hidden className="size-4 shrink-0 text-primary" />
            {company.email}
          </a>
          <p className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground">
            <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
            {company.city}
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 aria-hidden className="size-4 shrink-0 text-primary" />
            Mo–Fr 09:00–17:00 Uhr
          </p>
          <p className="pt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Termine nach Vereinbarung
          </p>
        </address>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {company.name}. Alle Rechte vorbehalten.
          </p>
          <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/impressum" className="transition-colors hover:text-foreground">
              Impressum
            </Link>
            <Link to="/datenschutz" className="transition-colors hover:text-foreground">
              Datenschutz
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
