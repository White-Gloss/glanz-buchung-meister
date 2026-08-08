import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { z } from "zod";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { absUrl } from "@/lib/seo";
import { company } from "@/lib/servicesConfig";

/**
 * DANKE-SEITE
 * -----------
 * Wird nach einer erfolgreichen Buchungsanfrage aufgerufen.
 * Eigene URL (/danke) ermöglicht sauberes Conversion-Tracking
 * in Google Ads und Meta Pixel ohne clientseitige Events.
 *
 * Query-Parameter (alle optional):
 *   nr   – Anfragenummer (z. B. WG-2025-0042)
 *   name – Vorname oder Vollname des Kunden
 */

const searchSchema = z.object({
  nr: z.string().optional(),
  name: z.string().optional(),
});

export const Route = createFileRoute("/danke")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Danke für Ihre Anfrage | White Gloss Detailing" },
      {
        name: "description",
        content: "Ihre Buchungsanfrage ist eingegangen. Wir bestätigen Ihren Termin in Kürze.",
      },
      // Seite soll nicht in Suchergebnissen erscheinen
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: absUrl("/danke") }],
  }),
  component: DankePage,
});

function DankePage() {
  const { nr, name } = useSearch({ from: "/danke" });
  const firstName = name ? name.split(" ")[0] : null;

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
          {/* Erfolgs-Icon */}
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-primary/15 glow-ring">
            <CheckCircle2 className="size-10 text-primary" />
          </div>

          {/* Überschrift */}
          <h1 className="display-page mt-8 uppercase">
            {firstName ? `Danke, ${firstName}!` : "Vielen Dank!"}
          </h1>

          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            Ihre Buchungsanfrage ist bei uns eingegangen. Wir prüfen den Termin und melden uns in
            Kürze mit der verbindlichen Bestätigung – per E-Mail oder telefonisch.
          </p>

          {/* Anfragenummer */}
          {nr && (
            <p className="mt-5 rounded-2xl bg-secondary/50 px-6 py-3 text-sm">
              Ihre Anfragenummer:
              <span className="font-semibold text-foreground">{nr}</span>
            </p>
          )}

          {/* Was passiert als nächstes */}
          <div className="glass mt-10 w-full rounded-2xl p-6 text-left">
            <h2 className="label-caps text-foreground">Wie geht es weiter?</h2>
            <ol className="mt-4 space-y-3">
              {[
                "Wir prüfen Ihre Anfrage und die Terminverfügbarkeit.",
                "Sie erhalten die verbindliche Bestätigung per E-Mail.",
                "Bei Rückfragen melden wir uns telefonisch.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 text-[0.6rem] font-semibold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Kontakt-Alternativen */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <a href={company.whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden className="size-4" />
                Per WhatsApp schreiben
              </a>
            </Button>
            <Button asChild variant="ghost" size="lg" className="rounded-full">
              <a href={company.phoneHref}>
                <Phone aria-hidden className="size-4" />
                {company.phone}
              </a>
            </Button>
          </div>

          {/* Zurück zur Startseite */}
          <Link
            to="/"
            className="mt-10 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Zurück zur Startseite
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
