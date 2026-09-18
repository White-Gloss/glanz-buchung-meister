import { site } from "@/data/site";

interface WhatsAppPhotoCtaProps {
  className?: string;
}

export function WhatsAppPhotoCta({ className = "" }: WhatsAppPhotoCtaProps) {
  const whatsappPhotoUrl =
    "https://wa.me/4915233540284?text=Hallo%20White%20Gloss%2C%20ich%20h%C3%A4tte%20gerne%20eine%20kurze%20Foto-Einsch%C3%A4tzung%20f%C3%BCr%20mein%20Fahrzeug.";

  return (
    <div
      className={`rounded-card border border-line bg-surface p-6 sm:p-8 relative overflow-hidden ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
            Schnell-Check per Foto
          </div>
          <h3 className="heading-3 mt-3 text-xl sm:text-2xl">
            Unsicher, welches Paket Ihr Fahrzeug benötigt?
          </h3>
          <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
            Sparen Sie Zeit: Senden Sie uns einfach 2–3 Fotos von Lack oder Innenraum per WhatsApp.
            Herr Hägele prüft den Zustand und gibt Ihnen eine ehrliche, unverbindliche Empfehlung
            für das optimale Paket.
          </p>
          <div className="mt-4 flex flex-wrap gap-y-2 gap-x-6 text-xs text-subtle">
            <span>✓ Schnelle Rückmeldung</span>
            <span>✓ 100 % unverbindlich & kostenlos</span>
            <span>✓ Kein Verkaufsdruck</span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-3">
          <a
            href={whatsappPhotoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-emerald-700 hover:bg-emerald-600 text-white font-medium px-6 py-3.5 rounded-sm inline-flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              aria-hidden="true"
            >
              <path d="M7.9 20A9 9 0 1 0 4 16.1L3 21z" />
            </svg>
            <span>Fotos per WhatsApp senden</span>
          </a>
          <span className="text-center text-xs text-subtle">
            Direkter Kontakt: {site.phoneDisplay}
          </span>
        </div>
      </div>
    </div>
  );
}
