import { Link } from "@tanstack/react-router";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";

export function NotFoundComponent() {
  return (
    <main id="main-content" className="page-doc mx-auto max-w-3xl px-4 pb-24 sm:px-6" tabIndex={-1}>
      <p className="kicker">404</p>
      <h1 className="heading-2 mt-4">Diese Seite gibt es nicht.</h1>
      <p className="mt-5 max-w-xl text-muted leading-relaxed">
        Die Adresse führt ins Leere – vertippt, veraltet oder nie vorhanden.
        Zurück zur Startseite, zu den Preisen oder direkt anfragen.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/" className={ctaPrimary}>
          Startseite
        </Link>
        <Link to="/preise" className={ctaGhost}>
          Preise
        </Link>
        <Link to="/kontakt" className={ctaGhost}>
          Kontakt
        </Link>
        <a href={site.whatsapp} className={ctaGhost} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </div>
    </main>
  );
}
