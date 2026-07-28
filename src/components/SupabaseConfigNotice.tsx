import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SupabaseConfigNotice({ missing }: { missing: string[] }) {
  return (
    <main className="min-h-dvh bg-background text-foreground flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="heading-md mb-3">Backend nicht verbunden</h1>
        <p className="text-muted-foreground mb-4">
          Das Admin-Dashboard kann nicht geladen werden, weil die Zugangsdaten zum Backend in
          dieser Version der Website fehlen. Bitte veröffentlichen Sie die Seite erneut, damit die
          aktuellen Einstellungen übernommen werden.
        </p>
        {missing.length > 0 && (
          <p className="text-sm text-muted-foreground mb-6">
            Fehlende Konfiguration:{" "}
            <span className="font-mono text-foreground">{missing.join(", ")}</span>
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/">Zur Startseite</Link>
          </Button>
          <Button className="min-h-11" onClick={() => window.location.reload()}>
            Erneut versuchen
          </Button>
        </div>
      </div>
    </main>
  );
}
