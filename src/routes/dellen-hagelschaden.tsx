import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoInquiry } from "@/components/photo-inquiry";
import { PageHero } from "@/components/page-hero";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/dellen-hagelschaden")({
  component: DellenPage,
  head: () =>
    pageHead({
      title: `Dellenentfernung & Hagelschaden-Reparatur | ${site.name}`,
      description:
        "Parkdellen, Karosseriedellen und Hagelschäden lackschadenfrei ausbeulen, sofern technisch möglich. Foto-Begutachtung, Preis nach Prüfung.",
      path: "/dellen-hagelschaden",
      preloadShot: "dellen",
    }),
});

function DellenPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="dellen"
        alt="Parkdelle unter Streiflicht, bevor wir ausbeulen"
        kicker="Smart Repair"
        title="Dellenentfernung und Hagelschaden."
        lead="Parkdellen, kleinere Dellen und Hagelschäden holen wir lackschadenfrei raus, wenn es technisch geht. Das können Sie unabhängig von den Aufbereitungspaketen anfragen."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Leistungen", to: "/leistungen" },
          { label: "Dellen" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted leading-relaxed">
        Einen Preis gibt es erst, wenn wir den Schaden gesehen haben. Ohne Ihre
        Zustimmung machen wir nichts. Bei kleinen Stellen reicht oft ein Foto
        zur ersten Einschätzung.
      </p>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {[
          ["Parkdellen", "Dellen durch Türen und enge Parkplätze"],
          ["Karosseriedellen", "Kleinere Verformungen an zugänglichen Bauteilen"],
          ["Hagelschäden", "Einzelne oder zahlreiche Hageldellen"],
          ["Foto-Begutachtung", "Bei kleinen Schäden häufig ohne ersten Vor-Ort-Termin möglich"],
        ].map(([t, d]) => (
          <li key={t} className="border border-line bg-surface p-5">
            <p className="font-display text-xl tracking-tight">{t}</p>
            <p className="mt-2 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ul>
      <div className="mt-12">
        <PhotoInquiry
          title="Begutachtung Dellen & Hagel"
          hint="Mehrere Fotos: Gesamtansicht, schräges Licht, Nahaufnahme. Dateien bleiben auf Ihrem Gerät. Übermittelt werden nur Dateinamen zur Zuordnung – die eigentliche Begutachtung holen wir bei Bedarf über einen sicheren Kanal nach."
        />
      </div>
      </div>
    </main>
  );
}
