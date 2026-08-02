import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCalendarFeedToken, regenerateCalendarFeedToken } from "@/lib/calendarFeed.functions";

/**
 * Private Kalender-Adresse zum Abonnieren in Handy/Outlook/Google Kalender.
 * Der Token wird bewusst erst bei Bedarf (Klick) abgerufen, nicht beim
 * Laden der Seite — die Adresse landet dann seltener versehentlich in
 * Screenshots oder Bildschirmfreigaben des Admin-Bereichs.
 */
export function CalendarFeedCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchToken = useServerFn(getCalendarFeedToken);
  const regenerate = useServerFn(regenerateCalendarFeedToken);

  async function reveal() {
    setLoading(true);
    try {
      const { token } = await fetchToken({});
      setUrl(`${window.location.origin}/kalender/${token}.ics`);
    } catch {
      toast.error("Kalender-Adresse konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        "Neue Adresse erzeugen? Die bisherige Kalender-Adresse funktioniert danach nicht mehr — sie muss in jedem Kalender neu abonniert werden.",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const { token } = await regenerate({});
      setUrl(`${window.location.origin}/kalender/${token}.ics`);
      toast.success("Neue Kalender-Adresse erzeugt.");
    } catch {
      toast.error("Konnte keine neue Adresse erzeugen.");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => toast.success("Adresse kopiert."));
  }

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Calendar className="size-4 text-primary" aria-hidden />
        <h2 className="display-card text-sm uppercase">Kalender-Feed</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Einmal in Handy, Outlook oder Google Kalender abonnieren — danach erscheinen alle Buchungen
        automatisch mit Kunde, Kennzeichen, Paket und Abholort. Die Adresse ist geheim und darf
        nicht weitergegeben werden.
      </p>

      {!url ? (
        <Button onClick={reveal} loading={loading} className="mt-4">
          Adresse anzeigen
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-xs text-foreground">{url}</code>
            <button
              type="button"
              onClick={copy}
              aria-label="Adresse kopieren"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Copy className="size-4" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            loading={loading}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            Neue Adresse erzeugen
          </Button>
        </div>
      )}
    </section>
  );
}
