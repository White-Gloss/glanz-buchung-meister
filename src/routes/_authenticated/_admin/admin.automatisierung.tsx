import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  Mail,
  ReceiptText,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CalendarFeedCard } from "@/components/CalendarFeedCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MailStatusCard } from "@/components/MailStatusCard";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { diagnoseBackendError } from "@/lib/backendErrors";
import {
  getAutomationSetupStatus,
  type AutomationSetupStatus,
} from "@/lib/automationDiagnostics.functions";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

export const Route = createFileRoute("/_authenticated/_admin/admin/automatisierung")({
  head: () => ({
    meta: [
      { title: "Automatisierung – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AutomationRoute,
  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function AutomationRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <AutomationPage />;
}

type StatusTone = "ready" | "pending" | "off";

type SetupCardProps = {
  icon: LucideIcon;
  title: string;
  status: string;
  tone: StatusTone;
  description: string;
  detail?: string;
};

function SetupCard({ icon: Icon, title, status, tone, description, detail }: SetupCardProps) {
  const badge =
    tone === "ready"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
      : tone === "pending"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
        : "border-border bg-secondary/40 text-muted-foreground";

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon aria-hidden className="size-4 text-primary" />
          <h2 className="display-card text-sm uppercase">{title}</h2>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs ${badge}`}>{status}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      {detail ? (
        <div className="mt-4 rounded-xl border border-border bg-secondary/25 px-3 py-2 text-xs text-foreground/75">
          {detail}
        </div>
      ) : null}
    </section>
  );
}

function AutomationPage() {
  const [status, setStatus] = useState<AutomationSetupStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const fetchStatus = useServerFn(getAutomationSetupStatus);

  useEffect(() => {
    let active = true;
    fetchStatus({})
      .then((result) => {
        if (!active) return;
        setStatus(result);
        setStatusError(false);
      })
      .catch(() => {
        if (active) setStatusError(true);
      });
    return () => {
      active = false;
    };
  }, [fetchStatus]);

  const lexwareReady = Boolean(status?.lexwareApiKeySet);
  const reminderReady = Boolean(status?.reminderCronSecretSet);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">
              <ArrowLeft aria-hidden className="size-4" />
              Dashboard
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="display-sub truncate text-xl sm:text-2xl">Automatisierung</h1>
            <p className="truncate text-sm text-muted-foreground">
              E-Mail, Kalender, Lexware und Terminerinnerungen
            </p>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="glass overflow-hidden rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-primary">
                <Workflow aria-hidden className="size-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  White Gloss Workflow
                </span>
              </div>
              <h2 className="display-sub mt-3 text-2xl sm:text-3xl">
                Buchung rein. Bestätigen. Der Rest läuft automatisch.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                Hier siehst du auf einen Blick, welche Verbindungen aktiv sind. Geheimschlüssel
                bleiben ausschließlich serverseitig und werden im Browser weder angezeigt noch
                gespeichert.
              </p>
            </div>
            <div className="grid min-w-[220px] gap-2 text-sm">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-200">
                <ShieldCheck aria-hidden className="size-4" />
                Admin-geschützte Diagnose
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-2 text-muted-foreground">
                <KeyRound aria-hidden className="size-4" />
                Keine Secrets im Frontend
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SetupCard
            icon={Mail}
            title="E-Mail"
            status="vorhanden"
            tone="ready"
            description="Eingangsbestätigung, interne Buchungsmeldung, Terminbestätigung, Rechnungs-PDF und Terminerinnerung nutzen den serverseitigen Mailversand."
            detail="Der echte Versandstatus und eine Testmail stehen weiter unten."
          />
          <SetupCard
            icon={CalendarDays}
            title="Kalender"
            status="vorhanden"
            tone="ready"
            description="Ein privater ICS-Feed stellt bestätigte Buchungsdaten für Google Kalender, Outlook und Handy-Kalender bereit."
            detail="Die geheime Kalender-Adresse kannst du weiter unten erzeugen oder erneuern."
          />
          <SetupCard
            icon={ReceiptText}
            title="Lexware"
            status={statusError ? "Statusfehler" : lexwareReady ? "bereit" : "nicht verbunden"}
            tone={lexwareReady ? "ready" : "pending"}
            description={
              lexwareReady
                ? "Der Lexware-API-Schlüssel ist serverseitig hinterlegt. Bestätigte Buchungen können automatisch als Lexware-Rechnung verarbeitet werden."
                : "Für die automatische Rechnungsübergabe fehlt noch der serverseitige Lexware-API-Schlüssel."
            }
            detail="Server-Variable: LEXWARE_API_KEY — der Wert wird hier absichtlich niemals angezeigt."
          />
          <SetupCard
            icon={BellRing}
            title="Erinnerungen"
            status={
              statusError
                ? "Statusfehler"
                : reminderReady
                  ? "bereit für Scheduler"
                  : "noch nicht aktiv"
            }
            tone={reminderReady ? "ready" : "pending"}
            description="Die Versandroutine für bestätigte Termine ist vorhanden und schützt gegen Doppelversand. Für den vollautomatischen Betrieb muss der geschützte Cron-Endpunkt regelmäßig aufgerufen werden."
            detail={
              reminderReady
                ? "REMINDER_CRON_SECRET ist hinterlegt. Jetzt muss nur noch der stündliche Cronjob beim Hosting aktiviert sein."
                : "Server-Variable REMINDER_CRON_SECRET fehlt noch; ohne sie lehnt der Cron-Endpunkt jeden Automationslauf ab."
            }
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ErrorBoundary title="Der E-Mail-Status konnte nicht geladen werden">
            <div className="[&>section]:mt-0">
              <MailStatusCard />
            </div>
          </ErrorBoundary>
          <ErrorBoundary title="Der Kalender-Feed konnte nicht geladen werden">
            <CalendarFeedCard />
          </ErrorBoundary>
        </div>

        <section className="glass mt-6 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">Zielablauf</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {[
              ["1", "Buchung", "Kunde bucht über whitegloss.de"],
              ["2", "Eingang", "Bestätigung und interne Meldung per E-Mail"],
              ["3", "Freigabe", "Du setzt den Auftrag im Admin auf Bestätigt"],
              ["4", "Rechnung", "Lexware übernimmt Kunde und erstellt die PDF-Rechnung"],
              ["5", "Termin", "Kalender und Terminerinnerung greifen automatisch"],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-xl border border-border bg-secondary/20 p-4">
                <span className="text-xs font-semibold text-primary">SCHRITT {number}</span>
                <p className="mt-2 font-medium">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          {!lexwareReady ? (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p>
                Lexware bleibt bewusst deaktiviert, bis der API-Schlüssel als Server-Secret beim
                Hoster hinterlegt ist. Trage den Schlüssel nicht in Quellcode, GitHub oder ein
                sichtbares Formular ein.
              </p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
