import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenText,
  Bot,
  Camera,
  CircleDotDashed,
  CircleHelp,
  ImageIcon,
  Inbox,
  Newspaper,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { extras, packages, pickupPricing, site } from "@/data/site";
import { eur } from "@/lib/utils";
import { getOperatorSettings, setOperatorPin } from "@/lib/admin.functions";
import { createSiteBackup, getSiteBackup, restoreSiteBackup } from "@/lib/backup.functions";
import { Button, Field, inputClass } from "@/components/ui";

export const Route = createFileRoute("/admin/einstellungen")({
  component: AdminSettings,
});

const groups = [
  {
    title: "Angebot & Website",
    description: "Was Kunden auf der Website sehen und buchen können.",
    items: [
      {
        to: "/admin/leistungen" as const,
        label: "Dienstleistungen",
        text: "Pakete, Beschreibungen und eigene Leistungen pflegen.",
        icon: Sparkles,
      },
      {
        to: "/admin/galerie" as const,
        label: "Fahrzeuggalerie",
        text: "Referenzfotos und Bildunterschriften verwalten.",
        icon: ImageIcon,
      },
      {
        to: "/admin/faqs" as const,
        label: "Häufige Fragen",
        text: "FAQ-Inhalte ergänzen, die auf der öffentlichen Seite erscheinen.",
        icon: CircleHelp,
      },
      {
        to: "/admin/blog" as const,
        label: "Ratgeber",
        text: "Zusätzliche Beiträge für Auffindbarkeit und Beratung.",
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
        text: "Formular, Fotoanfragen und ausgehende Bestätigungen.",
        icon: Inbox,
      },
      {
        to: "/admin/zustand" as const,
        label: "Zustandsmeldungen",
        text: "Kundenfotos und Zustandsbeschreibungen prüfen.",
        icon: Camera,
      },
      {
        to: "/admin/dellen" as const,
        label: "Dellen & Hagelschäden",
        text: "Begutachtungsanfragen und Schadensfotos.",
        icon: CircleDotDashed,
      },
      {
        to: "/admin/automatisierung" as const,
        label: "Automatisierung",
        text: "E-Mail, Kalender, Erinnerungen und KI-Agent für WhatsApp/Telegram.",
        icon: Bot,
      },
      {
        to: "/admin/unterlagen" as const,
        label: "Dokumentvorbereitung",
        text: "Angebote, Rechnungen und Zahlungserinnerungen.",
        icon: BookOpenText,
      },
      {
        to: "/admin/bitrix" as const,
        label: "Bitrix24",
        text: "API-Schlüssel und Übertragung der Website-Buchungen als Aufträge.",
        icon: Workflow,
      },
    ],
  },
];

function AdminSettings() {
  const [pin, setPin] = useState("");
  const [savedPin, setSavedPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [backup, setBackup] = useState<{ exists: boolean; bytes: number; at: string | null } | null>(
    null,
  );
  const [backupMsg, setBackupMsg] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    void getOperatorSettings()
      .then((s) => {
        setSavedPin(s.pin);
        setPin(s.pin);
      })
      .catch(() => undefined);
    void getSiteBackup()
      .then(setBackup)
      .catch(() => undefined);
  }, []);

  async function onPin(e: FormEvent) {
    e.preventDefault();
    setPinMsg("");
    try {
      await setOperatorPin({ data: { pin } });
      setSavedPin(pin);
      setPinMsg("PIN gespeichert. WhatsApp und Telegram nutzen denselben Schlüssel.");
    } catch (err) {
      setPinMsg(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-md bg-elevated text-fg">
          <Settings aria-hidden className="size-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Verwaltung</p>
          <h1 className="mt-1 font-display text-4xl">Einstellungen</h1>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Buchungen, Posteingang und Kalender bleiben oben. Hier liegen Website-Pflege,
        Fotoeingänge und die Automatisierung – wie im bisherigen Betrieb, in der Optik
        der neuen Website.
      </p>

      <p className="mt-6 text-sm text-muted">
        {site.legalName} · {site.owner} · {site.street}, {site.postalCode} {site.city} ·{" "}
        {site.email}
      </p>

      <div className="mt-10 space-y-10">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="font-display text-2xl">{group.title}</h2>
            <p className="mt-1 text-sm text-muted">{group.description}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex min-h-40 flex-col rounded-md border border-line bg-surface p-5 hover:border-fg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <item.icon aria-hidden className="size-5 text-fg" />
                    <ArrowRight
                      aria-hidden
                      className="size-4 text-subtle transition-transform group-hover:translate-x-1"
                    />
                  </div>
                  <h3 className="mt-5 font-display text-xl">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">Öffentliche Preisliste</h2>
        <p className="mt-2 text-sm text-muted">
          Quelle der Website. ERPNext-Überschreibungen greifen, sobald die Anbindung aktiv ist.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
          {packages.map((p) => (
            <li key={p.id}>
              {p.name} · ab {eur(p.price)} · {p.duration}
            </li>
          ))}
          {extras.map((e) => (
            <li key={e.id}>
              {e.name} · ab {eur(e.price)}
            </li>
          ))}
          {pickupPricing.tiers.map((t) => (
            <li key={t.id}>
              {t.label}: {t.amount === 0 ? "kostenlos" : eur(t.amount)}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onPin} className="mt-8 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">Agent-PIN</h2>
        <p className="mt-2 text-sm text-muted">
          WhatsApp und Telegram steuern den Betrieb nur mit diesem PIN. Tokens bleiben serverseitig
          beim Hoster. Aktuell gesetzt: {savedPin || "—"}
        </p>
        <div className="mt-4">
          <Field id="operator-pin" label="PIN (mindestens 6 Zeichen)">
            <input
              id="operator-pin"
              className={inputClass}
              value={pin}
              minLength={6}
              maxLength={40}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>
        {pinMsg ? <p className="mt-3 text-sm text-muted">{pinMsg}</p> : null}
        <Button type="submit" className="mt-4">
          PIN speichern
        </Button>
      </form>

      <section className="mt-8 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">Sicherung</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Speichert diesen Stand der neuen Website. Die öffentliche Domain bleibt
          unberührt. Wiederherstellen setzt nur diesen Stand zurück – die alte
          Live-Seite wird nicht gelöscht.
        </p>
        <p className="mt-3 text-sm text-muted">
          {backup?.exists && backup.at
            ? `Letzte Sicherung: ${new Date(backup.at).toLocaleString("de-DE")} · ${(backup.bytes / 1024 / 1024).toFixed(1)} MB`
            : "Noch keine Sicherung."}
        </p>
        {backupMsg ? <p className="mt-3 text-sm text-muted">{backupMsg}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={backupBusy}
            onClick={() => {
              setBackupBusy(true);
              setBackupMsg("");
              void createSiteBackup()
                .then((row) => {
                  setBackup(row);
                  setBackupMsg("Sicherung geschrieben.");
                })
                .catch((err: unknown) => {
                  setBackupMsg(err instanceof Error ? err.message : "Sicherung fehlgeschlagen.");
                })
                .finally(() => setBackupBusy(false));
            }}
          >
            Sicherung anlegen
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={backupBusy || !backup?.exists}
            onClick={() => {
              if (!window.confirm("Diesen gesicherten Stand wirklich zurückspielen?")) return;
              setBackupBusy(true);
              setBackupMsg("");
              void restoreSiteBackup()
                .then(() => {
                  setBackupMsg("Stand zurückgespielt. Seite neu laden.");
                })
                .catch((err: unknown) => {
                  setBackupMsg(err instanceof Error ? err.message : "Wiederherstellen fehlgeschlagen.");
                })
                .finally(() => setBackupBusy(false));
            }}
          >
            Sicherung wiederherstellen
          </Button>
        </div>
      </section>
    </main>
  );
}
