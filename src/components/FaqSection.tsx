import { Link } from "@tanstack/react-router";
import { ChevronDown, MessageCircle, Phone } from "lucide-react";
import type { FaqRow } from "@/lib/faqs.functions";
import { company } from "@/lib/servicesConfig";
import { trackContactFromContent, trackLeadFromContent } from "@/lib/metaPixel";

/**
 * FAQ-ABSCHNITT
 * --------------
 * Wird auf der FAQ-Seite und unter Ratgeber-Beiträgen verwendet.
 *
 * Aufbau bewusst mit <details>/<summary> statt einer JavaScript-Lösung:
 *   - Der Antworttext steht auch ohne JavaScript im HTML und ist damit
 *     für Google vollständig lesbar (Voraussetzung für das FAQ-Snippet).
 *   - Auf- und Zuklappen sowie Tastaturbedienung bringt der Browser mit,
 *     ganz ohne zusätzliches ARIA-Gerüst.
 *   - Kein Layoutsprung beim Hydrieren, weil der Zustand im Markup steckt.
 */

export function FaqSection({
  faqs,
  headingId,
  /** Kennzeichnet in der Anzeigenmessung, aus welchem Abschnitt eine Anfrage kam. */
  trackingSource,
}: {
  faqs: FaqRow[];
  headingId?: string;
  trackingSource: string;
}) {
  if (faqs.length === 0) return null;

  return (
    <div className="space-y-3" aria-labelledby={headingId}>
      {faqs.map((faq) => (
        <details
          key={faq.id}
          className="hairline-gold group rounded-2xl bg-card/60 p-5 [&[open]>summary>svg]:rotate-180"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-4 list-none [&::-webkit-details-marker]:hidden">
            <h3 className="display-card text-sm uppercase text-foreground">{faq.question}</h3>
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-primary transition-transform duration-200"
            />
          </summary>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{faq.answer}</p>
        </details>
      ))}

      <FaqContactBand trackingSource={trackingSource} />
    </div>
  );
}

/**
 * Handlungsaufforderung unter den Fragen. Die Klicks werden — sofern der
 * Besucher der Anzeigenmessung zugestimmt hat — als Contact- bzw.
 * Lead-Ereignis an Meta gemeldet. Ohne Einwilligung passiert nichts.
 */
function FaqContactBand({ trackingSource }: { trackingSource: string }) {
  return (
    <div className="glass mt-6 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-6 text-muted-foreground">
        Ihre Frage war nicht dabei? Wir beantworten sie gern persönlich — meist noch am selben Tag.
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <a
          href={company.phoneHref}
          onClick={() => trackContactFromContent(`${trackingSource}:telefon`)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-input px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Phone className="size-4 text-primary" />
          Anrufen
        </a>
        <a
          href={company.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackContactFromContent(`${trackingSource}:whatsapp`)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-input px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <MessageCircle className="size-4 text-primary" />
          WhatsApp
        </a>
        <Link
          to="/"
          hash="buchung"
          onClick={() => trackLeadFromContent(`${trackingSource}:terminanfrage`)}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Termin anfragen
        </Link>
      </div>
    </div>
  );
}
