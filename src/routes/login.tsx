import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { BrandMark } from "@/components/media";
import { Button, Field, inputClass } from "@/components/ui";
import { site } from "@/data/site";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({
    meta: [
      { title: `Anmeldung Betrieb | ${site.name}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
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

  return (
    <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-16" tabIndex={-1}>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <BrandMark variant="auth" />
          <h1 className="mt-4 font-display text-4xl">Betrieb</h1>
          <p className="mt-2 text-sm text-muted">
            Anmeldung für Buchungen, Posteingang, Kalender und Automatisierung.
            Neue Konten werden nicht öffentlich angelegt.
          </p>
        </div>
        {authEnabled ? (
          <>
            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <button
                  key={p.providerId}
                  type="button"
                  onClick={() => signIn(p.providerId, { callbackURL: "/admin" })}
                  className="w-full min-h-11 rounded-full border border-line px-4 text-sm hover:bg-elevated"
                >
                  Weiter mit {p.label}
                </button>
              ))}
            </div>
            {emailAndPasswordEnabled ? (
              <form onSubmit={onEmail} className="space-y-3 border-t border-line pt-5">
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
                    autoComplete="current-password"
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </Field>
                {error ? (
                  <p className="text-sm text-danger" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={pending}>
                  Mit E-Mail anmelden
                </Button>
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
