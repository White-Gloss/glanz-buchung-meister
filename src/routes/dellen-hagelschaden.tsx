import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoInquiry } from "@/components/photo-inquiry";
import { Shot } from "@/components/media";
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
    }),
});

function DellenPage() {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <nav aria-label="Brotkrumen" className="text-xs text-subtle">
        <Link to="/" className="hover:text-fg">
          Startseite
        </Link>
        <span className="px-2">/</span>
        <Link to="/leistungen" className="hover:text-fg">
          Leistungen
        </Link>
        <span className="px-2">/</span>
        <span>Dellen</span>
      </nav>
      <h1 className="mt-6 font-display text-5xl">Dellenentfernung & Hagelschaden</h1>
      <Shot
        name="dellen"
        alt="Parkdelle unter Streiflicht, bevor wir ausbeulen"
        className="mt-8 aspect-[3/2] w-full"
        sizes="(min-width: 768px) 48rem, 100vw"
        priority
      />
      <p className="mt-3 text-xs text-subtle">
        Unser Auto. Unter Streiflicht sieht man die Delle deutlich – so schauen
        wir sie uns an, bevor wir rangehen.
      </p>
      <p className="mt-4 text-muted leading-relaxed">
        Parkdellen, kleinere Dellen und Hagelschäden holen wir lackschadenfrei
        raus, wenn es technisch geht. Das können Sie unabhängig von den
        Aufbereitungspaketen anfragen.
      </p>
      <p className="mt-4 text-sm text-muted">
        Einen Preis gibt es erst, wenn wir den Schaden gesehen haben. Ohne Ihre
        Zustimmung machen wir nichts. Bei kleinen Stellen reicht oft ein Foto
        zur ersten Einschätzung.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {[
          ["Parkdellen", "Dellen durch Türen und enge Parkplätze"],
          ["Karosseriedellen", "Kleinere Verformungen an zugänglichen Bauteilen"],
          ["Hagelschäden", "Einzelne oder zahlreiche Hageldellen"],
          ["Foto-Begutachtung", "Bei kleinen Schäden häufig ohne ersten Vor-Ort-Termin"],
        ].map(([t, d]) => (
          <li key={t} className="rounded-md border border-line bg-surface p-4">
            <p className="font-medium">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ul>
      <div className="mt-12">
        <PhotoInquiry
          title="Begutachtung Dellen & Hagel"
          hint="Mehrere Fotos: Gesamtansicht, schräges Licht, Nahaufnahme. Dateien bleiben auf Ihrem Gerät. Übermittelt werden nur Dateinamen zur Zuordnung – die eigentliche Begutachtung holen wir bei Bedarf über einen sicheren Kanal nach."
        />
      </div>
    </main>
  );
}
