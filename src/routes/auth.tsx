import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { company } from "@/lib/servicesConfig";

export const Route = createFileRoute("/auth")({
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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Willkommen zurück");
        navigate({ to: "/admin" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Konto erstellt. Bitte E-Mail bestätigen, falls erforderlich.");
        navigate({ to: "/admin" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Zur Website
          </Link>
        </Button>
        <div className="glass rounded-3xl p-6 sm:p-8">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/15">
            <Lock className="size-5 text-primary" />
          </div>
          <h1 className="display-sub mt-5">
            {mode === "login" ? "Team-Login" : "Team-Konto erstellen"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Interner Bereich von {company.name}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-secondary/40"
                placeholder="admin@whitegloss.de"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-secondary/40"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Konto erstellen"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {mode === "login"
              ? "Noch kein Konto? Jetzt registrieren"
              : "Bereits registriert? Zum Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
