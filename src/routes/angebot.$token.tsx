import { useEffect, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { acceptOffer, getOfferByToken, type OfferView } from "@/lib/bookings.functions";
import { currency, TIME_NOTICE } from "@/lib/bookings";
import { company } from "@/lib/servicesConfig";
import { absUrl } from "@/lib/seo";

/**
 * TERMINWAHL AUS DEM GEGENANGEBOT
 * --------------------------------
 * Ziel der Links aus der Angebots-E-Mail. Der Zugriff läuft allein über
 * das Zugriffstoken der Buchung — kein Login, weil Kundinnen und Kunden
 * hier keines haben.
 *
 * BEWUSST ZWEISTUFIG: Der Link aus der Mail wählt nur vor, zugesagt wird
 * erst mit dem Klick auf dieser Seite. Mailprogramme und Sicherheits-
 * scanner rufen Links teils von sich aus ab; eine Zusage allein durch
 * Linkaufruf würde dadurch ungewollt ausgelöst.
 *
 * Die Seite wird nicht indexiert (noindex) — sie gehört einer einzelnen
 * Anfrage und hat in Suchergebnissen nichts verloren.
 */

type Suche = { termin?: string };

export const Route = createFileRoute("/angebot/$token")({
  validateSearch: (search: Record<string, unknown>): Suche => ({
    termin: typeof search.termin === "string" ? search.termin.slice(0, 10) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Ihr Angebot – ${company.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: absUrl("/") }],
  }),
  component: OfferPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { dateStyle: "full" });
}

function OfferPage() {
  const { token } = Route.useParams();
  const { termin } = useSearch({ from: "/angebot/$token" });

  const [offer, setOffer] = useState<OfferView | null | "laedt">("laedt");
  const [selected, setSelected] = useState<string | null>(termin ?? null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const fetchOffer = useServerFn(getOfferByToken);
  const accept = useServerFn(acceptOffer);

  useEffect(() => {
    let active = true;
    void fetchOffer({ data: { token } })
      .then((result) => active && setOffer(result))
      .catch(() => active && setOffer(null));
    return () => {
      active = false;
    };
  }, [fetchOffer, token]);

  async function zusagen() {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await accept({ data: { token, date: selected } });
      setDone(result.date);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Der Termin konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="eyebrow">Ihr persönliches Angebot</p>
            <h1 className="text-gradient display-page mt-3">Termin auswählen</h1>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          {offer === "laedt" && (
            <p className="text-sm text-muted-foreground">Angebot wird geladen …</p>
          )}

          {offer === null && (
            <div className="glass rounded-3xl p-8 text-center">
              <p className="display-card uppercase">Angebot nicht gefunden</p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Dieser Link gehört zu keiner Anfrage — möglicherweise ist er unvollständig kopiert
                worden. Rufen Sie uns gerne an unter {company.phone}.
              </p>
            </div>
          )}

          {offer && offer !== "laedt" && done && (
            <div className="glass rounded-3xl p-8 text-center">
              <CheckCircle2 aria-hidden className="mx-auto size-8 text-primary" />
              <p className="display-card mt-4 uppercase">Termin bestätigt</p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Wir haben Ihren Termin am{" "}
                <strong className="text-foreground">{formatDate(done)}</strong> fest eingeplant. Die
                Bestätigung ist zusätzlich per E-Mail unterwegs.
              </p>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                {TIME_NOTICE}
              </p>
            </div>
          )}

          {offer && offer !== "laedt" && !done && offer.status !== "Gegenangebot gesendet" && (
            <div className="glass rounded-3xl p-8 text-center">
              <p className="display-card uppercase">
                {offer.status === "Bestätigt" ? "Termin bereits bestätigt" : "Kein offenes Angebot"}
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {offer.status === "Bestätigt"
                  ? `Ihr Termin am ${formatDate(offer.requestedDate)} steht bereits fest.`
                  : "Zu dieser Anfrage liegt derzeit kein Angebot zur Auswahl vor."}{" "}
                Fragen? {company.phone}
              </p>
            </div>
          )}

          {offer && offer !== "laedt" && !done && offer.status === "Gegenangebot gesendet" && (
            <>
              <div className="glass rounded-3xl p-6 sm:p-8">
                <p className="text-sm text-muted-foreground">
                  Hallo {offer.customerName}, hier ist unser Angebot zu Anfrage{" "}
                  {offer.invoiceNumber}.
                </p>
                <p className="mt-4 flex flex-wrap items-baseline gap-3">
                  <span className="display-price text-3xl text-foreground">
                    {currency(offer.price)}
                  </span>
                  <span className="text-xs text-muted-foreground">inkl. gesetzlicher MwSt.</span>
                </p>
                {offer.note && (
                  <p className="mt-4 rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
                    <strong className="text-foreground/85">Warum dieser Preis:</strong> {offer.note}
                  </p>
                )}
                {offer.isNewCustomer && offer.depositAmount > 0 && (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    Zur verbindlichen Reservierung bitten wir Erstkunden um eine Anzahlung von{" "}
                    <strong className="text-foreground">{currency(offer.depositAmount)}</strong>.
                    Wie und bis wann, teilen wir Ihnen direkt nach Ihrer Zusage mit.
                  </p>
                )}
              </div>

              <fieldset className="mt-8">
                <legend className="label-caps mb-3 text-muted-foreground">
                  Bitte wählen Sie einen Termin
                </legend>
                <div className="grid gap-3">
                  {[offer.requestedDate, ...offer.altDates].map((datum, index) => {
                    const active = selected === datum;
                    return (
                      <button
                        key={datum}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelected(datum)}
                        className={[
                          "flex min-h-16 items-center gap-4 rounded-2xl border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary bg-primary/10 glow-ring"
                            : "cursor-pointer border-border bg-secondary/30 hover:border-primary/50",
                        ].join(" ")}
                      >
                        <CalendarCheck
                          aria-hidden
                          className={`size-5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span>
                          <span className="block text-sm text-foreground">{formatDate(datum)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {index === 0 ? "Ihr Wunschtermin" : `Ersatztermin ${index}`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <p className="mt-6 rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
                {TIME_NOTICE}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button size="lg" disabled={!selected || saving} loading={saving} onClick={zusagen}>
                  {saving ? "Wird gespeichert …" : "Termin verbindlich zusagen"}
                </Button>
                <a
                  href={`tel:${company.phoneHref.replace("tel:", "")}`}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Passt nichts? {company.phone}
                </a>
              </div>
            </>
          )}
        </section>
      </main>
      <SiteFooter />
      <Toaster position="top-center" richColors />
    </div>
  );
}
