import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/integrations/supabase/get-client";
import { isAdminUser } from "@/lib/bookings.functions";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await isAdminUser();
      return { isAdmin };
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: AdminGate,
});

function AdminGate() {
  const { isAdmin } = Route.useRouteContext();

  if (!isAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 py-16">
        <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
          <ShieldAlert aria-hidden className="mx-auto size-8 text-destructive" />
          <h1 className="display-sub mt-4">Kein Administrator-Zugriff</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ihr Konto besitzt keine Admin-Rolle. Bitte lassen Sie sich von einem bestehenden
            Administrator freischalten.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/">Zur Website</Link>
            </Button>
            <Button
              onClick={async () => {
                const supabase = await getSupabaseClient();
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              Abmelden
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return <Outlet />;
}
