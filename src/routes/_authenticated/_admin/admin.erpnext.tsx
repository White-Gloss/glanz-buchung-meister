import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Database } from "lucide-react";

import { ErpNextStatusCard } from "@/components/ErpNextStatusCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_admin/admin/erpnext")({
  head: () => ({
    meta: [
      { title: "ERPNext Status – WHITE GLOSS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ErpNextDiagnosticsPage,
});

function ErpNextDiagnosticsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/admin">
              <ArrowLeft className="size-4" />
              Zurück
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <Database className="size-4 shrink-0 text-primary" />
            <h1 className="display-card truncate text-sm uppercase">ERPNext · WHITE GLOSS OS</h1>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="glass rounded-2xl p-5 text-sm leading-6 text-muted-foreground">
          <p>
            Geschützter Verbindungstest zwischen dem WHITE-GLOSS-Adminbereich, Supabase und ERPNext.
            Der Test verändert keine Kunden-, Auftrags- oder Finanzdaten.
          </p>
        </div>
        <ErpNextStatusCard />
      </main>
    </div>
  );
}
