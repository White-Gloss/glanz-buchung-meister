import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { company } from "@/lib/servicesConfig";

type ConversionBandProps = {
  eyebrow?: string;
  title?: string;
  text?: string;
};

export function ConversionBand({
  eyebrow = "Bereit für den Unterschied?",
  title = "Ihr Fahrzeug. Unser Anspruch.",
  text = "Wählen Sie Ihr Paket und senden Sie Ihre unverbindliche Terminanfrage in wenigen Minuten.",
}: ConversionBandProps) {
  return (
    <section className="content-auto mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="metal-panel relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
        <div className="chrome-orb -right-24 -top-32" aria-hidden />
        <div className="relative grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-3xl">
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="display-section mt-3 text-balance uppercase">{title}</h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">{text}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/" hash="buchung">
                Termin anfragen
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <a href={company.whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden className="size-4" />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
        <div className="relative mt-8 border-t border-border/80 pt-5">
          <a
            href={company.phoneHref}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Phone aria-hidden className="size-4 text-primary" />
            Persönliche Rückfrage: {company.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
