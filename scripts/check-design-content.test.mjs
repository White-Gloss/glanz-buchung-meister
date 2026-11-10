import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compareSource, inspectDesignContent } from "./check-design-content.mjs";

const fixture = `
const goals = ["Sauber im Alltag.", "Dauerhafter Schutz."];
export const Route = createFileRoute("/")({
  head: () => pageHead({ title: "Aufbereitung | White Gloss", description: "Fahrzeugpflege in Horb", path: "/" }),
});
function Page() {
  return <main id="main-content">
    <h1>Ihr Fahrzeug.</h1>
    <section><h2>Unsere Pakete</h2><p>Persönlich geprüft.</p></section>
    {goals.map((goal) => <p key={goal}>{goal}</p>)}
    <Link to="/preise" hash="buchung" search={{ paket: "premium" }}>Termin anfragen</Link>
    <Field label="E-Mail"><input placeholder="name@example.de" /></Field>
    <LazyGoogleReviews />
  </main>;
}`;

const differences = (changed, original = fixture) => compareSource(original, changed, "src/routes/index.tsx");

test("layout, class, inline-style and wrapper changes preserve the content inventory", () => {
  const changed = fixture
    .replace('<main id="main-content">', '<main id="main-content" className="editorial" style={{ color: "white" }}>')
    .replace("<h1>Ihr Fahrzeug.</h1>", '<h1 className="display"><span>Ihr Fahrzeug.</span></h1>')
    .replace("<section>", '<section className="chapter"><div>')
    .replace("</section>", "</div></section>");
  assert.deepEqual(differences(changed), []);
});

test("reordering complete sections does not count as deleted copy", () => {
  const first = "<h1>Ihr Fahrzeug.</h1>";
  const second = "<section><h2>Unsere Pakete</h2><p>Persönlich geprüft.</p></section>";
  assert.deepEqual(differences(fixture.replace(`${first}\n    ${second}`, `${second}\n    ${first}`)), []);
});

test("deleting or rewriting existing marketing copy is rejected", () => {
  assert.ok(differences(fixture.replace("Persönlich geprüft.", "Für höchste Ansprüche.")).some((entry) => entry.kind === "text" && entry.value === "Persönlich geprüft."));
  assert.ok(differences(fixture.replace("<p>Persönlich geprüft.</p>", "")).some((entry) => entry.kind === "text"));
});

test("the guard preserves repeated copy occurrences, not merely unique words", () => {
  const before = "const Page = () => <><p>Termin anfragen</p><footer>Termin anfragen</footer></>;";
  const after = "const Page = () => <><p>Termin anfragen</p><footer /></>;";
  assert.deepEqual(differences(after, before).find((entry) => entry.kind === "text"), {
    file: "src/routes/index.tsx", kind: "text", value: "Termin anfragen", count: 1,
  });
});

test("heading levels and dynamic heading expressions are protected", () => {
  assert.ok(differences(fixture.replace("<h2>Unsere Pakete</h2>", "<h3>Unsere Pakete</h3>")).some((entry) => entry.kind === "headings"));
  const before = "const Page = () => <h1>{service.title}</h1>;";
  assert.ok(differences(before.replace("service.title", "service.teaser"), before).some((entry) => entry.kind === "headings"));
});

test("links, anchor destinations and their package preselection remain intact", () => {
  for (const [before, after] of [["/preise", "/kontakt"], ["buchung", "anfrage"], ['paket: "premium"', 'paket: "basis"']]) {
    assert.ok(differences(fixture.replace(before, after)).some((entry) => entry.kind === "links"));
  }
});

test("data-backed local copy and form labels cannot be silently changed", () => {
  assert.ok(differences(fixture.replace("Dauerhafter Schutz.", "Neues Werbeversprechen.")).some((entry) => entry.kind === "copy"));
  assert.ok(differences(fixture.replace('label="E-Mail"', 'label="Kontakt"')).some((entry) => entry.kind === "text"));
});

test("dynamic output and dynamic component titles cannot be redirected to different data", () => {
  const before = '<><p>{money(pack.price)} €</p><PageHero title={service.title} /></>';
  assert.ok(differences(before.replace("pack.price", "pack.duration"), before).some((entry) => entry.kind === "expressions"));
  assert.ok(differences(before.replace("service.title", "service.teaser"), before).some((entry) => entry.kind === "expressions"));
});

test("removing a component with no inline text is caught", () => {
  assert.ok(differences(fixture.replace("<LazyGoogleReviews />", "")).some((entry) => entry.kind === "components" && entry.value === "LazyGoogleReviews"));
});

test("SEO metadata and structured data are protected, font preloads are presentation", () => {
  assert.ok(differences(fixture.replace("Fahrzeugpflege in Horb", "Autoaufbereitung in Berlin")).some((entry) => entry.kind === "seo"));
  const before = `const fonts = ["/fonts/old.woff2"];
    const head = {meta: [{name: "robots", content: "index,follow"}], links: fonts};
    const schema = serializeJsonLd({"@type": "LocalBusiness", name: "White Gloss"});`;
  assert.deepEqual(differences(before.replace("old.woff2", "new.woff2"), before), []);
  assert.ok(differences(before.replace("index,follow", "noindex,follow"), before).some((entry) => entry.kind === "seo"));
  assert.ok(differences(before.replace("LocalBusiness", "Organization"), before).some((entry) => entry.kind === "seo"));
});

test("repository comparison includes public routes and immutable source data", () => {
  const cwd = mkdtempSync(join(tmpdir(), "white-gloss-content-"));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    mkdirSync(join(cwd, "src/routes"), { recursive: true });
    mkdirSync(join(cwd, "src/data"), { recursive: true });
    writeFileSync(join(cwd, "src/routes/index.tsx"), fixture);
    writeFileSync(join(cwd, "src/data/site.ts"), 'export const price = 149;\n');
    git("init", "-q");
    git("add", ".");
    git("-c", "user.name=Content Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Content baseline");
    const base = git("rev-parse", "HEAD").trim();
    const initial = inspectDesignContent({ base, cwd });
    assert.equal(initial.passed, true);
    assert.equal(initial.sourceFiles, 1);
    assert.equal(initial.protectedFiles, 1);
    assert.ok(initial.seoEntries > 0);
    writeFileSync(join(cwd, "src/data/site.ts"), 'export const price = 199;\n');
    writeFileSync(join(cwd, "src/routes/index.tsx"), fixture.replace("Ihr Fahrzeug.", "Unsere Website."));
    const changed = inspectDesignContent({ base, cwd });
    assert.equal(changed.passed, false);
    assert.ok(changed.failures.some((entry) => entry.kind === "protected-source"));
    assert.ok(changed.failures.some((entry) => entry.kind === "text"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
