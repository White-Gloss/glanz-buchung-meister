import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHero } from "@/components/page-hero";
import { SubmissionResult } from "@/components/submission-result";
import { Button, Field, inputLine } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { isEmailAddress } from "@/lib/utils";
import { submitWithdrawal } from "@/lib/withdrawal.functions";

export const Route = createFileRoute("/vertrag-widerrufen")({
  validateSearch: (search: Record<string, unknown>): { vorgang?: string } =>
    typeof search.vorgang === "string" && /^WG-\d{1,10}$/.test(search.vorgang)
      ? { vorgang: search.vorgang }
      : {},
  component: WithdrawalFunctionPage,
  head: () =>
    pageHead({
      title: `Vertrag widerrufen | ${site.name}`,
      description:
        "Widerrufsfunktion nach § 356a BGB: Einen online mit White Gloss Detailing geschlossenen Vertrag widerrufen.",
      path: "/vertrag-widerrufen",
      robots: "noindex,follow",
    }),
});

type Receipt = Awaited<ReturnType<typeof submitWithdrawal>>;
type Errors = Partial<Record<"name" | "contract" | "part" | "email", string>>;

function validate(input: {
  name: string;
  contract: string;
  scope: "gesamt" | "teil";
  part: string;
  email: string;
}): Errors {
  const errors: Errors = {};
  if (input.name.trim().length < 2) errors.name = "Bitte Ihren Namen angeben.";
  if (input.contract.trim().length < 3)
    errors.contract =
      "Bitte den Vertrag bezeichnen, z. B. mit Vorgangsnummer oder Leistung und Datum.";
  if (input.scope === "teil" && input.part.trim().length < 3)
    errors.part = "Bitte angeben, welchen Teil des Vertrags Sie widerrufen.";
  if (!isEmailAddress(input.email.trim()))
    errors.email = "Bitte eine gültige E-Mail-Adresse für die Eingangsbestätigung angeben.";
  return errors;
}

/** UUID v4 auch für Browser ohne crypto.randomUUID (ältere Safari-/WebView-Versionen). */
function newWithdrawalRequestId(): string {
  const source = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  if (source && typeof source.randomUUID === "function") return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (source && typeof source.getRandomValues === "function") source.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function WithdrawalFunctionPage() {
  const { vorgang } = Route.useSearch();
  const [name, setName] = useState("");
  const [contract, setContract] = useState(vorgang ? `Vorgang ${vorgang}` : "");
  const [scope, setScope] = useState<"gesamt" | "teil">("gesamt");
  const [part, setPart] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  // Die Kennung gehört zu genau einem Formularinhalt: Wiederholungen nach einem
  // Verbindungsfehler nutzen dieselbe, geänderte Angaben bekommen eine neue.
  const [attempt, setAttempt] = useState<{ snapshot: string; id: string } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const next = validate({ name, contract, scope, part, email });
    setErrors(next);
    if (Object.keys(next).length) {
      setError("Bitte prüfen Sie die markierten Felder.");
      const first = Object.keys(next)[0];
      event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const data = {
      name: name.trim(),
      contract: contract.trim(),
      scope,
      part: scope === "teil" ? part.trim() : undefined,
      email: email.trim(),
    };
    const snapshot = JSON.stringify(data);
    const requestId =
      attempt?.snapshot === snapshot ? attempt.id : newWithdrawalRequestId();
    setAttempt({ snapshot, id: requestId });
    setPending(true);
    setError("");
    try {
      const result = await submitWithdrawal({ data: { ...data, requestId, website } });
      setReceipt(result);
    } catch {
      setError(
        `Ihr Widerruf konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut oder senden Sie ihn per E-Mail an ${site.email}. Für die Frist genügt die rechtzeitige Absendung.`,
      );
    } finally {
      setPending(false);
    }
  }

  const fieldError = (key: keyof Errors) =>
    errors[key] ? (
      <p id={`wr-${key}-error`} className="text-sm text-danger" role="alert">
        {errors[key]}
      </p>
    ) : null;
  const describedBy = (key: keyof Errors) => (errors[key] ? `wr-${key}-error` : undefined);

  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker="Rechtliches"
        title="Vertrag widerrufen."
        lead="Hier widerrufen Sie einen mit uns online oder per E-Mail geschlossenen Vertrag – ohne Angabe von Gründen."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "Vertrag widerrufen" }]}
      />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-16 text-sm leading-relaxed sm:px-6">
        <p className="text-muted">
          Verbraucherinnen und Verbraucher können einen im Fernabsatz geschlossenen Vertrag
          innerhalb der Widerrufsfrist mit dieser Funktion widerrufen. Einzelheiten zu Frist und
          Folgen finden Sie in der{" "}
          <Link to="/widerruf" className="underline hover:text-fg">
            Widerrufsbelehrung
          </Link>
          . Sie können uns Ihren Widerruf ebenso per E-Mail an{" "}
          <a href={`mailto:${site.email}`} className="underline hover:text-fg">
            {site.email}
          </a>{" "}
          oder per Brief an {site.ownerLegalName}, {site.legalName}, {site.street},{" "}
          {site.postalCode} {site.city} mitteilen.
        </p>

        {receipt ? (
          <div className="space-y-4 rounded-card border border-line bg-surface p-5">
            <SubmissionResult className="font-display text-2xl text-fg">
              Ihr Widerruf ist eingegangen.
            </SubmissionResult>
            <dl className="grid gap-2 text-muted sm:grid-cols-[auto_1fr] sm:gap-x-6">
              <dt className="text-fg">Eingang</dt>
              <dd>{receipt.receivedAtLabel}</dd>
              <dt className="text-fg">Referenz</dt>
              <dd>{receipt.reference}</dd>
            </dl>
            <div>
              <p className="text-fg">Inhalt Ihrer Widerrufserklärung</p>
              <ul className="mt-2 space-y-1 text-muted">
                {receipt.declaration.map((line, index) => (
                  <li key={index} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-muted">
              Eine Eingangsbestätigung mit diesem Inhalt sowie Datum und Uhrzeit des Eingangs
              senden wir unverzüglich an{" "}
              <strong className="break-words text-fg">{receipt.email}</strong>. Bitte prüfen Sie
              auch Ihren Spam-Ordner.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            data-hide-whatsapp
            aria-label="Vertrag widerrufen"
            className="relative space-y-5 rounded-card border border-line bg-surface p-5"
          >
            <h2 className="font-display text-2xl">Widerrufserklärung</h2>
            <Field tone="public" id="wr-name" label="Ihr Name">
              <input
                id="wr-name"
                name="name"
                className={inputLine}
                autoComplete="name"
                maxLength={120}
                required
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy("name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {fieldError("name")}
            </Field>
            <Field
              tone="public"
              id="wr-contract"
              label="Welchen Vertrag widerrufen Sie? (Vorgangsnummer oder Leistung und Datum)"
            >
              <textarea
                id="wr-contract"
                name="contract"
                className={`${inputLine} min-h-20 py-2`}
                maxLength={500}
                required
                placeholder="z. B. Vorgang WG-123, Keramikschutz, angenommen am 2. Oktober 2026"
                aria-invalid={errors.contract ? true : undefined}
                aria-describedby={describedBy("contract")}
                value={contract}
                onChange={(e) => setContract(e.target.value)}
              />
              {fieldError("contract")}
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium uppercase tracking-[0.08em] text-muted">
                Umfang des Widerrufs
              </legend>
              <label className="flex items-start gap-2 text-muted">
                <input
                  type="radio"
                  name="scope"
                  className="mt-1"
                  checked={scope === "gesamt"}
                  onChange={() => setScope("gesamt")}
                />
                <span>Ich widerrufe den gesamten Vertrag.</span>
              </label>
              <label className="flex items-start gap-2 text-muted">
                <input
                  type="radio"
                  name="scope"
                  className="mt-1"
                  checked={scope === "teil"}
                  onChange={() => setScope("teil")}
                />
                <span>Ich widerrufe nur einen Teil des Vertrags.</span>
              </label>
            </fieldset>
            {scope === "teil" ? (
              <Field tone="public" id="wr-part" label="Welchen Teil widerrufen Sie?">
                <input
                  id="wr-part"
                  name="part"
                  className={inputLine}
                  maxLength={500}
                  placeholder="z. B. Zusatzleistung Lederpflege"
                  aria-invalid={errors.part ? true : undefined}
                  aria-describedby={describedBy("part")}
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                />
                {fieldError("part")}
              </Field>
            ) : null}
            <Field tone="public" id="wr-email" label="E-Mail-Adresse für die Eingangsbestätigung">
              <input
                id="wr-email"
                name="email"
                type="email"
                className={inputLine}
                autoComplete="email"
                maxLength={160}
                required
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldError("email")}
            </Field>
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="wr-website">Website</label>
              <input
                id="wr-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <p className="text-xs text-subtle">
              Ein Grund ist nicht erforderlich. Nach dem Absenden erhalten Sie unverzüglich eine
              Eingangsbestätigung per E-Mail mit dem Inhalt Ihrer Erklärung sowie Datum und Uhrzeit
              des Eingangs. Wie wir diese Angaben verarbeiten, steht in der{" "}
              <Link to="/datenschutz" className="underline hover:text-fg">
                Datenschutzerklärung
              </Link>
              .
            </p>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              tone="public"
              type="submit"
              className="w-full"
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? "Wird übermittelt …" : "Widerruf bestätigen"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
