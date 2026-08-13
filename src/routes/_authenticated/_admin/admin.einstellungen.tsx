import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenText,
  Bot,
  Camera,
  CircleHelp,
  ImageIcon,
  Inbox,
  Newspaper,
  Settings,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const groups = [
  {
    title: "Angebot & Website",
    description: "Was Kunden auf der Website sehen und buchen können.",
    items: [
      {
        to: "/admin/leistungen" as const,
        label: "Dienstleistungen",
        text: "Eigene Leistungen, Beschreibungen und Veröffentlichungsstatus pflegen.",
        icon: Sparkles,
      },
      {
        to: "/admin/galerie" as const,
        label: "Fahrzeuggalerie",
        text: "Vorher-/Nachher-Fotos und Referenzen verwalten.",
        icon: ImageIcon,
      },
      {
        to: "/admin/faqs" as const,
        label: "Häufige Fragen",
        text: "FAQ-Inhalte und Reihenfolge bearbeiten.",
        icon: CircleHelp,
      },
      {
        to: "/admin/blog" as const,
        label: "Ratgeber",
        text: "Beiträge, Bilder und Suchmaschinenangaben bearbeiten.",
        icon: Newspaper,
      },
    ],
  },
  {
    title: "Kommunikation & Abläufe",
    description: "Eingänge prüfen und wiederkehrende Arbeit steuern.",
    items: [
      {
        to: "/admin/posteingang" as const,
        label: "Posteingang",
        text: "Firmenpostfach im Lesemodus öffnen.",
        icon: Inbox,
      },
      {
        to: "/admin/zustand" as const,
        label: "Zustandsmeldungen",
        text: "Kundenfotos und Zustandsbeschreibungen prüfen.",
        icon: Camera,
      },
      {
        to: "/admin/automatisierung" as const,
        label: "Automatisierung",
        text: "Erinnerungen, Nachfassaktionen und Systemstatus prüfen.",
        icon: Bot,
      },
      {
        to: "/admin/unterlagen" as const,
        label: "Dokumentvorbereitung",
        text: "Bearbeitbare Angebote, Rechnungen und Zahlungserinnerungen erstellen.",
        icon: BookOpenText,
      },
    ],
  },
];

function SettingsPage() {
  return (
    <main id="main-content" className="min-h-dvh bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Settings aria-hidden className="size-5" />
          </span>
          <div>
            <p className="eyebrow">Verwaltung</p>
            <h1 className="display-sub mt-1">Einstellungen</h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Alle seltener benötigten Pflegebereiche sind hier gebündelt. Buchungen, Kundenakten und
          Dokumente bleiben als tägliche Hauptbereiche oben direkt erreichbar.
        </p>

        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.title} aria-labelledby={`settings-${group.title}`}>
              <h2 id={`settings-${group.title}`} className="display-card text-lg">
                {group.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="glass group flex min-h-40 flex-col rounded-2xl p-5 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <item.icon aria-hidden className="size-5 text-primary" />
                      <ArrowRight
                        aria-hidden
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                      />
                    </div>
                    <h3 className="display-card mt-5">{item.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
