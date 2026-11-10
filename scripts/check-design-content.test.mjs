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

function withApprovedSourceFixture(check) {
  const cwd = mkdtempSync(join(tmpdir(), "white-gloss-approved-content-"));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const write = (name, text) => writeFileSync(join(cwd, name), text);
  const commit = (message) => {
    git("add", ".");
    git("-c", "user.name=Content Test", "-c", "user.email=test@example.invalid", "commit", "-qm", message);
    return git("rev-parse", "HEAD").trim();
  };
  try {
    for (const dir of ["src/routes", "src/components", "src/data"])
      mkdirSync(join(cwd, dir), { recursive: true });
    const approvedFiles = ["src/components/configurator.tsx", "src/routes/danke.tsx"];
    for (const name of [...approvedFiles, "src/routes/index.tsx"]) write(name, fixture);
    write("src/data/site.ts", "export const price = 149;\n");
    git("init", "-q");
    const base = commit("Original content and prices");
    const approved = fixture
      .replace("Persönlich geprüft.", "Fotos können Sie später nachreichen. Eine neue Anfrage ist nicht nötig.")
      .replace("function Page()", 'function onSubmit() { setError("Ihre Anfrage ist bereits gespeichert."); }\nfunction Page()');
    for (const name of approvedFiles) write(name, approved);
    // Even a price change in the newer commit must not change the global
    // protected-data baseline when only two source files are approved.
    write("src/data/site.ts", "export const price = 199;\n");
    const sourceCommit = commit("Approved request copy and unrelated price edit");
    write("src/data/site.ts", "export const price = 149;\n");
    const sourceBaselines = Object.fromEntries(approvedFiles.map((name) => [name, {
      commit: sourceCommit, pullRequest: 327,
      pullRequestUrl: "https://github.com/White-Gloss/glanz-buchung-meister/pull/327",
    }]));
    check({ cwd, base, sourceCommit, sourceBaselines, approved, write, git });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("explicit source pins accept the exact approved copy and report every actual baseline", () => {
  withApprovedSourceFixture(({ cwd, base, sourceCommit, sourceBaselines }) => {
    assert.equal(inspectDesignContent({ cwd, base }).passed, false, "Custom bases must not inherit repository-specific approvals.");
    const result = inspectDesignContent({ cwd, base, sourceBaselines });
    assert.equal(result.passed, true);
    assert.equal(result.protectedBase, base);
    assert.deepEqual(result.sourceBaselines["src/routes/index.tsx"], { commit: base });
    for (const name of Object.keys(sourceBaselines)) {
      assert.equal(result.sourceBaselines[name].commit, sourceCommit);
      assert.equal(result.sourceBaselines[name].pullRequest, 327);
      assert.equal(result.sourceBaselines[name].pullRequestUrl, sourceBaselines[name].pullRequestUrl);
    }
  });
});

test("removing newly approved copy fails instead of exempting the pinned file", () => {
  withApprovedSourceFixture(({ cwd, base, sourceBaselines, approved, write }) => {
    write("src/routes/danke.tsx", approved.replace(" Eine neue Anfrage ist nicht nötig.", ""));
    const result = inspectDesignContent({ cwd, base, sourceBaselines });
    assert.equal(result.passed, false);
    assert.ok(result.failures.some((entry) => entry.file === "src/routes/danke.tsx" && entry.kind === "text" && entry.value.includes("Eine neue Anfrage ist nicht nötig.")));
  });
});

test("approved error messages rendered through state cannot be removed", () => {
  withApprovedSourceFixture(({ cwd, base, sourceBaselines, approved, write }) => {
    write("src/components/configurator.tsx", approved.replace('setError("Ihre Anfrage ist bereits gespeichert.");', ""));
    const result = inspectDesignContent({ cwd, base, sourceBaselines });
    assert.equal(result.passed, false);
    assert.ok(result.failures.some((entry) => entry.file === "src/components/configurator.tsx" && entry.kind === "text" && entry.value === "Ihre Anfrage ist bereits gespeichert."));
  });
});

test("the same copy change remains forbidden in a file without an explicit pin", () => {
  withApprovedSourceFixture(({ cwd, base, sourceBaselines, approved, write }) => {
    write("src/routes/index.tsx", approved);
    const result = inspectDesignContent({ cwd, base, sourceBaselines });
    assert.equal(result.passed, false);
    assert.ok(result.failures.some((entry) => entry.file === "src/routes/index.tsx" && entry.kind === "text" && entry.value === "Persönlich geprüft."));
  });
});

test("approved source pins still reject SEO edits and retain the original protected prices", () => {
  withApprovedSourceFixture(({ cwd, base, sourceBaselines, approved, write }) => {
    write("src/routes/danke.tsx", approved.replace("Fahrzeugpflege in Horb", "Geänderte Beschreibung"));
    write("src/data/site.ts", "export const price = 199;\n");
    const result = inspectDesignContent({ cwd, base, sourceBaselines });
    assert.equal(result.passed, false);
    assert.ok(result.failures.some((entry) => entry.file === "src/routes/danke.tsx" && entry.kind === "seo"));
    assert.ok(result.failures.some((entry) => entry.file === "src/data/site.ts" && entry.kind === "protected-source"));
  });
});

test("unavailable or mutable source baselines and missing baseline files fail closed", () => {
  withApprovedSourceFixture(({ cwd, base, sourceBaselines, write, git }) => {
    const name = "src/routes/danke.tsx";
    for (const [commit, error] of [["1".repeat(40), /Source baseline unavailable/], ["HEAD", /immutable full commit SHA/]]) {
      assert.throws(() => inspectDesignContent({ cwd, base, sourceBaselines: { ...sourceBaselines, [name]: { commit } } }), error);
    }
    rmSync(join(cwd, name));
    git("add", ".");
    git("-c", "user.name=Content Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "A commit without the approved file");
    write(name, fixture);
    assert.throws(() => inspectDesignContent({ cwd, base, sourceBaselines: {
      ...sourceBaselines, [name]: { commit: git("rev-parse", "HEAD").trim() },
    } }), /Source baseline file unavailable/);
    assert.throws(() => inspectDesignContent({ cwd, base, sourceBaselines: {
      "src/data/site.ts": { commit: base },
    } }), /unprotected public TSX source/);
  });
});
