import { Link } from "@tanstack/react-router";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";

export function NotFoundComponent() {
  return (
    <main id="main-content" className="page-doc mx-auto max-w-3xl px-4 pb-24 sm:px-6" tabIndex={-1}>
      <p className="kicker">404</p>
      <h1 className="heading-2 mt-4">Seite nicht gefunden</h1>
      <p className="mt-5 max-w-xl text-muted leading-relaxed">
        Unter dieser Adresse wurde keine Seite gefunden. Prüfen Sie die Adresse
        oder nutzen Sie die Links zur Startseite, zu den Preisen und zum Kontakt.
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
