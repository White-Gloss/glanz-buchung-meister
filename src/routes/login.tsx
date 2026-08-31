import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient, authEnabled, signInWithGoogle } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import {
  bootstrapOperator,
  googleLoginAvailable,
  operatorBootstrapNeeded,
} from "@/lib/auth/operator-login.functions";
import { BrandMark } from "@/components/media";
import { Button, Field, inputClass } from "@/components/ui";
import { site } from "@/data/site";

export const Route = createFileRoute("/login")({
  component: Login,
  loader: async () => {
    const [bootstrap, google] = await Promise.all([
      operatorBootstrapNeeded(),
      googleLoginAvailable(),
    ]);
    return { bootstrap, google };
  },
  head: () => ({
    meta: [
      { title: `Anmeldung Betrieb | ${site.name}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function Login() {
  const { bootstrap, google } = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"signin" | "bootstrap">(
    bootstrap.needed ? "bootstrap" : "signin",
  );

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "bootstrap") {
        await bootstrapOperator({ data: { email, password } });
      }
      const { error: err } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/admin",
      });
      if (err) throw new Error(err.message);
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
      setPending(false);
    }
  }

  async function onGoogle() {
    setError("");
    if (import.meta.env.PROD && !google.native) {
      setError(
        "Google-Anmeldung ist auf dem Live-Server noch nicht vollständig eingerichtet. Nutzen Sie die Betriebs-E-Mail.",
      );
      return;
    }
    setPending(true);
    try {
      await signInWithGoogle({ callbackURL: "/admin", errorCallbackURL: "/login" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Google-Anmeldung fehlgeschlagen. Nutzen Sie die Betriebs-E-Mail.",
      );
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-16" tabIndex={-1}>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <BrandMark variant="auth" />
          <h1 className="mt-4 font-display text-4xl">Betrieb</h1>
          <p className="mt-2 text-sm text-muted">
            Anmeldung nur für den Inhaber und beauftragte Mitarbeiter. Google ist nur für
            Adressen @white-gloss.de und ausdrücklich freigeschaltete Postfächer zugelassen.
          </p>
        </div>
        {authEnabled ? (
          <>
            <button
              type="button"
              onClick={onGoogle}
              disabled={pending}
              className="w-full min-h-11 rounded-full border border-line px-4 text-sm hover:bg-elevated disabled:opacity-50"
            >
              Weiter mit Google
            </button>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            {emailAndPasswordEnabled ? (
              <form onSubmit={onEmail} className="space-y-3 border-t border-line pt-5">
                <p className="text-xs text-subtle">
                  {mode === "bootstrap"
                    ? "Erstes Betriebskonto (E-Mail @white-gloss.de, Passwort mindestens 10 Zeichen)."
                    : "Oder mit E-Mail und Passwort."}
                </p>
                <Field id="email" label="E-Mail">
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field id="password" label="Passwort">
                  <input
                    id="password"
                    type="password"
                    autoComplete={mode === "bootstrap" ? "new-password" : "current-password"}
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={mode === "bootstrap" ? 10 : 8}
                    required
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={pending}>
                  {mode === "bootstrap" ? "Erstes Betriebskonto einrichten" : "Mit E-Mail anmelden"}
                </Button>
                {bootstrap.needed && mode === "signin" ? (
                  <button
                    type="button"
                    className="w-full min-h-11 text-center text-xs text-muted hover:text-fg"
                    onClick={() => setMode("bootstrap")}
                  >
                    Noch kein Betriebskonto? Erstes Konto einrichten
                  </button>
                ) : null}
              </form>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Anmeldung ist deaktiviert.</p>
        )}
        <Link to="/" className="block text-center text-sm text-muted hover:text-fg">
          Zur Website
        </Link>
      </div>
    </main>
  );
}
