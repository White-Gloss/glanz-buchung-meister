import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { getSupabaseClient } from "@/integrations/supabase/get-client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Neues Passwort festlegen – White Gloss Detailing" },
      {
        name: "description",
        content: "Setzen Sie Ihr Passwort für den internen Bereich von White Gloss Detailing neu.",
      },
      { property: "og:title", content: "Neues Passwort festlegen – White Gloss Detailing" },
      {
        property: "og:description",
        content: "Passwort für das Admin-Dashboard von White Gloss Detailing zurücksetzen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase setzt beim Öffnen des Recovery-Links eine temporäre Session.
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getSupabaseClient().then((supabase) => {
      if (!active) return;
      supabase.auth.getSession().then(({ data }) => {
        if (active) setReady(Boolean(data.session));
      });
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) setReady(true);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Passwort aktualisiert.");
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passwort konnte nicht geändert werden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main id="main-content" className="grid min-h-dvh place-items-center bg-background px-4 py-16">
        <div className="w-full max-w-md">
          <Button asChild variant="ghost" size="sm" className="mb-6">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Zur Website
            </Link>
          </Button>
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/15">
              <KeyRound aria-hidden className="size-5 text-primary" />
            </div>
            <h1 className="display-sub mt-5">Neues Passwort festlegen</h1>
            {!ready ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie über „Passwort
                vergessen?“ auf der{" "}
                <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
                  Login-Seite
                </Link>{" "}
                einen neuen Link an.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Neues Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-secondary/40"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Passwort bestätigen</Label>
                  <Input
                    id="confirm"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-11 bg-secondary/40"
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Bitte warten …" : "Passwort speichern"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Toaster position="top-center" richColors />
    </>
  );
}
