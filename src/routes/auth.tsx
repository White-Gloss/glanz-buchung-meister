import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { getSupabaseClient } from "@/integrations/supabase/get-client";
import { company } from "@/lib/servicesConfig";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Team-Login – White Gloss Detailing" },
      {
        name: "description",
        content:
          "Interner Zugang zum Admin-Dashboard von White Gloss Detailing für Buchungen und Rechnungen.",
      },
      { property: "og:title", content: "Team-Login – White Gloss Detailing" },
      {
        property: "og:description",
        content: "Anmeldung für das interne Buchungs- und Rechnungsmanagement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Bereits angemeldete Nutzer nicht auf dem Login-Formular stehen lassen.
  useEffect(() => {
    let active = true;
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(({ data }) => {
        if (!active) return;
        if (data.user) navigate({ to: "/admin", replace: true });
        else setChecking(false);
      }),
    ).catch(() => {
      if (active) setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = await getSupabaseClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await router.invalidate();
        toast.success("Willkommen zurück");
        navigate({ to: "/admin", replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Konto erstellt. Bitte E-Mail bestätigen, falls erforderlich.");
        navigate({ to: "/admin", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Falls ein Konto existiert, haben wir Ihnen einen Link gesendet.");
        setMode("login");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main id="main-content" className="grid min-h-dvh place-items-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Sitzung wird geprüft …</p>
      </main>
    );
  }

  const heading =
    mode === "login"
      ? "Team-Login"
      : mode === "signup"
        ? "Team-Konto erstellen"
        : "Passwort zurücksetzen";

  return (
    <>
      <main className="grid min-h-dvh place-items-center bg-background px-4 py-16">
        <div className="w-full max-w-md">
          <Button asChild variant="ghost" size="sm" className="mb-6">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Zur Website
            </Link>
          </Button>
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/15">
              <Lock aria-hidden className="size-5 text-primary" />
            </div>
            <h1 className="display-sub mt-5">{heading}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "Wir senden Ihnen einen Link zum Festlegen eines neuen Passworts."
                : `Interner Bereich von ${company.name}`}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  maxLength={160}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-secondary/40"
                  placeholder="admin@whitegloss.de"
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-secondary/40"
                    placeholder="••••••••"
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Bitte warten …"
                  : mode === "login"
                    ? "Anmelden"
                    : mode === "signup"
                      ? "Konto erstellen"
                      : "Link senden"}
              </Button>
            </form>

            <div className="mt-5 space-y-2 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {mode === "signup"
                  ? "Bereits registriert? Zum Login"
                  : "Noch kein Konto? Jetzt registrieren"}
              </button>
              {mode !== "forgot" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Passwort vergessen?
                </button>
              )}
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Zurück zum Login
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      <Toaster position="top-center" richColors />
    </>
  );
}
