import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-fg"
    >
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-2xl tracking-tight">Etwas ist schiefgelaufen.</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "Unerwarteter Fehler. Bitte die Seite neu laden."}
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-fg"
      >
        Zur Startseite
      </Link>
    </main>
  );
}
