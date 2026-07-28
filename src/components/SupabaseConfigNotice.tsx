import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BackendErrorInfo } from "@/lib/backendErrors";

type Props = {
  missing?: string[];
  info?: BackendErrorInfo;
  onRetry?: () => void;
};

export function SupabaseConfigNotice({ missing = [], info, onRetry }: Props) {
  const title = info?.title ?? "Backend nicht verbunden";
  const description =
    info?.description ??
    "Das Admin-Dashboard kann nicht geladen werden, weil die Zugangsdaten zum Backend in dieser Version der Website fehlen.";
  const hint =
    info?.hint ??
    "Bitte veröffentlichen Sie die Seite erneut, damit die aktuellen Einstellungen übernommen werden.";
  const missingKeys = info?.missing?.length ? info.missing : missing;

  return (
    <main className="min-h-dvh bg-background text-foreground flex items-center justify-center px-4 py-16">
      <div
        role="alert"
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="heading-md mb-3">{title}</h1>
        <p className="text-muted-foreground mb-4">{description}</p>
        {missingKeys.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-secondary/30 p-4 text-left">
            <p className="text-sm font-medium mb-2">Fehlende Konfiguration</p>
            <ul className="space-y-1">
              {missingKeys.map((key) => (
                <li key={key} className="font-mono text-sm text-foreground">
                  {key}
                </li>
              ))}
            </ul>
          </div>
        )}
        {hint && <p className="text-sm text-muted-foreground mb-6">{hint}</p>}
        {info?.technical && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Technische Details
            </summary>
            <p className="mt-2 break-words font-mono text-xs text-muted-foreground">
              {info.technical}
            </p>
          </details>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/">Zur Startseite</Link>
          </Button>
          <Button
            className="min-h-11"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
          >
            Erneut versuchen
          </Button>
        </div>
      </div>
    </main>
  );
}
