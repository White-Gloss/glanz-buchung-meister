import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, CheckCircle2, Mail } from "lucide-react";
import { z } from "zod";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { DENT_REPAIR_PRICE_LABEL } from "@/lib/dentRepair";
import { absUrl } from "@/lib/seo";

const searchSchema = z.object({ nr: z.string().optional(), name: z.string().optional() });

export const Route = createFileRoute("/danke-dellen")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Begutachtungsanfrage eingegangen | White Gloss" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: absUrl("/danke-dellen") }],
  }),
  component: DentThankYouPage,
});

function DentThankYouPage() {
  const { nr, name } = Route.useSearch();
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6"
      >
        <div className="grid size-20 place-items-center rounded-full bg-primary/15 glow-ring">
          <CheckCircle2 className="size-10 text-primary" />
        </div>
        <p className="eyebrow mt-8">Anfrage erfolgreich übermittelt</p>
        <h1 className="display-page mt-3 uppercase">
          {name ? `Vielen Dank, ${name}!` : "Vielen Dank!"}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          Ihre Anfrage zur Dellen- oder Hagelschaden-Begutachtung ist bei WHITE GLOSS eingegangen.
          Der gewünschte Termin dient zunächst der Schadenbegutachtung und individuellen
          Preisermittlung.
        </p>
        {nr && (
          <p className="mt-5 rounded-xl bg-secondary/50 px-5 py-3 text-sm">
            Anfragenummer: <strong>{nr}</strong>
          </p>
        )}

        <div className="glass mt-10 w-full rounded-3xl p-6 text-left sm:p-8">
          <div className="flex gap-3">
            <Camera className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h2 className="display-card uppercase">Wie geht es weiter?</h2>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <li>1. Wir prüfen Ihre Schadensangaben und hochgeladenen Fotos.</li>
                <li>2. Bei kleinen Schäden kann die Begutachtung vollständig per Foto erfolgen.</li>
                <li>
                  3. Andernfalls stimmen wir den persönlichen Begutachtungstermin mit Ihnen ab.
                </li>
                <li>
                  4. Sie erhalten den individuellen Preis. Die Reparatur erfolgt erst nach Ihrer
                  ausdrücklichen Zustimmung.
                </li>
              </ol>
            </div>
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Preis</p>
            <p className="mt-1 font-semibold text-primary">{DENT_REPAIR_PRICE_LABEL}</p>
          </div>
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="size-4 text-primary" /> Eine Bestätigung wurde an Ihre E-Mail-Adresse
          gesendet.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-8">
          <Link to="/">Zur Startseite</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}
