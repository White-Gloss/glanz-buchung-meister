import { createFileRoute, Link } from "@tanstack/react-router";
import { Shot } from "@/components/media";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/b2b")({
  component: B2bPage,
  head: () =>
    pageHead({
      title: `B2B Fahrzeugaufbereitung Flotten | ${site.name}`,
      description:
        "Leasingrückläufer, Fuhrpark, Autohäuser: individuelle Kalkulation statt Pauschalpreis. White Gloss in Horb am Neckar.",
      path: "/b2b",
    }),
});

function B2bPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <Shot
        name="atelier"
        alt="Werkstatt mit LED-Licht"
        className="h-[42vh] min-h-64 w-full"
        sizes="100vw"
        priority
        framed={false}
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <nav aria-label="Brotkrumen" className="text-xs text-subtle">
        <Link to="/" className="hover:text-fg">
          Startseite
        </Link>
        <span className="px-2">/</span>
        <span>B2B</span>
      </nav>
      <h1 className="mt-6 font-display text-5xl">Firmenkunden & Flotten</h1>
      <p className="mt-4 text-lg text-muted">
        Gepflegte Autos gehören zum Auftritt eines Betriebs. Für Unternehmen,
        Autohäuser und Fuhrparks rechnen wir deshalb am tatsächlichen Umfang,
        nicht an einer Pauschale.
      </p>
      <p className="mt-6 text-muted">
        Wie viele Fahrzeuge, in welchem Zustand, in welchem Rhythmus und mit
        welcher Logistik – das bestimmt den Preis. Am schnellsten klären wir das
        am Telefon oder per WhatsApp.
      </p>
      <div className="mt-10 grid gap-4">
        {[
          ["Leasingrückläufer", "Vor der Rückgabe holen wir die Stellen, die Gutachter sehen, im Umfang, den wir uns einig sind."],
          ["Flotten- & Fuhrparkreinigung", "Einmal oder in einem Rhythmus, der zu Ihrem Betrieb passt."],
          ["Autohäuser & Fahrzeughandel", "Aufbereitung für Verkauf, Standfläche und Auslieferung."],
          ["Firmen- & Poolfahrzeuge", "Innen und außen so, dass die Autos im Alltag wieder anständig aussehen."],
        ].map(([t, d]) => (
          <section key={t} className="rounded-md border border-line bg-surface p-5">
            <h2 className="font-display text-2xl">{t}</h2>
            <p className="mt-2 text-sm text-muted">{d}</p>
          </section>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={site.phoneHref}
          className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-fg"
        >
          {site.phoneDisplay}
        </a>
        <a
          href={site.whatsapp}
          className="inline-flex min-h-11 items-center rounded-sm border border-line px-5 text-sm"
        >
          WhatsApp
        </a>
      </div>
      </div>
    </main>
  );
}
