#!/usr/bin/env node
/**
 * Read-only source guard for a visual-only redesign. No server or build needed.
 *
 * It compares the working tree with a Git commit, not with snapshots silently
 * updated by the build. Source checks complement (and do not replace) rendered
 * CI checks: CSS visibility, live CMS content and runtime layout need a browser.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const DESIGN_BASE = "db305e3c190cf53a0213c90ea3e788625ece091d";
// PR #327 was approved and merged after the visual redesign. Its immutable
// source snapshot replaces the copy baseline for exactly these two files;
// it is not an exemption from comparing their new content and metadata.
const approvedBookingBaseline = Object.freeze({
  commit: "6daf3fc01834e94720ef4834f36e0534dfc93aaa",
  pullRequest: 327,
  pullRequestUrl: "https://github.com/White-Gloss/glanz-buchung-meister/pull/327",
});
export const APPROVED_SOURCE_BASELINES = Object.freeze({
  "src/components/configurator.tsx": approvedBookingBaseline,
  "src/routes/danke.tsx": approvedBookingBaseline,
});
// Explicitly approved CTA wording; these replace one literal each, not the
// file's source baseline. Other occurrences and all SEO/link checks remain.
export const APPROVED_CTA_LABELS = Object.freeze({
  "src/components/site-chrome.tsx": Object.freeze({
    className: "header-film-booking", before: "Termin anfragen", after: "Jetzt Termin anfragen",
  }),
  "src/components/scroll-film-hero.tsx": Object.freeze({
    className: "scroll-film-cta", before: "Fahrzeug verwandeln lassen", after: "Jetzt Termin anfragen",
  }),
});
// These exact Git blobs cover the November 14 SEO update. All other sources
// keep their original design or booking baselines. Hash the file locally so
// the check also works with a shallow GitHub checkout and squash merges.
export const APPROVED_SEO_BLOBS = Object.freeze({
  "src/components/city-landing.tsx": "247430d8f540af5cdb73c34984f59e202c6d5ebf",
  "src/data/site.ts": "3356ee2567830a37e3198d4b82bb12fba3c99ef8",
  "src/lib/city-copy.ts": "c330f37e051679cfdd34f160acb7f3d2fb4ac391",
  "src/lib/seo.ts": "3488b971e1941762b1a530c8861c26468a873067",
  "src/routes/abholservice.index.tsx": "e10fee117409229f91b76ee0862070d6664fb1de",
  "src/routes/agb.tsx": "b3d3628d17c61a71e4228cd1f0642a4168d61df0",
  "src/routes/galerie.tsx": "9e18230731dd64b42506c203fb634e6088ca5c5a",
  "src/routes/index.tsx": "234307c6d09511ffa4d04c3f5fc8b8f6c466c348",
  "src/routes/leistungen.index.tsx": "d51449039284566fa988c338e393b4d87cf065ad",
  "src/routes/ratgeber.$slug.tsx": "26f0c757f6589c29c41026d659b6cb4525028e70",
  "src/routes/ratgeber.index.tsx": "62a29a49f0e20f5268bc8d38e093f55dfd47d46d",
});

function sourceBlobId(source) {
  const bytes = Buffer.from(source.replace(/\r\n/g, "\n"), "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
const normalize = (value) => value.replace(/\s+/gu, " ").trim();
const protectedProps = new Set([
  "aria-label", "aria-description", "label", "title", "lead", "kicker", "description",
  "placeholder", "hint", "note", "message", "emptyMessage", "caption", "lines", "crumbs",
]);
const linkProps = new Set(["to", "href", "hash", "params", "search", "id", "htmlFor"]);
const cosmeticProps = /^(className|style|ref|key|src|srcSet|sizes|width|height|loading|decoding|poster|shot|image|photo|icon|on[A-Z]|data-)/;
const cosmeticComponents = /^(Fragment|RevealLines|Icon[A-Z]|[A-Z].*Icon$)/;

export const protectedFiles = [
  "src/data/site.ts", "src/data/ratgeber.ts", "src/data/local-proof.ts",
  "src/data/google-profile.ts", "src/data/search-watchlist.ts", "src/data/sitemap-static.xml",
  "src/lib/seo.ts", "src/lib/seo-policy.ts", "src/lib/seo-intents.ts", "src/lib/city-seo.ts",
  "src/lib/city-copy.ts", "src/lib/city-logistics.ts", "src/lib/article-navigation.ts",
  "src/lib/sitemap.ts", "src/lib/sitemap.server.ts", "src/lib/local-proof.ts",
  "src/lib/studio-public.ts", "src/lib/studio-public.functions.ts", "src/lib/json-ld.ts",
  "src/routes/sitemap[.]xml.ts", "public/robots.txt", "public/llms.txt",
];

const bag = () => new Map();
function add(target, value) {
  const normalized = normalize(value);
  if (normalized) target.set(normalized, (target.get(normalized) ?? 0) + 1);
}
function missing(before, after) {
  return [...before].flatMap(([value, count]) => {
    const difference = count - (after.get(value) ?? 0);
    return difference > 0 ? [{ value, count: difference }] : [];
  });
}

export function extractContent(source, filename = "fixture.tsx") {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = { text: bag(), headings: bag(), links: bag(), seo: bag(), components: bag(), copy: bag(), expressions: bag() };
  const declarations = new Map();
  const referencedCopy = new Set();
  const printed = (node) => normalize(printer.printNode(ts.EmitHint.Unspecified, node, file));
  const nameOf = (node) => node?.getText(file) ?? "";
  function index(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const existing = declarations.get(node.name.text) ?? [];
      existing.push(node.initializer);
      declarations.set(node.name.text, existing);
    }
    ts.forEachChild(node, index);
  }
  index(file);

  // Follow local constant data referenced by rendered expressions, including
  // package goals and the hero's default headline. Imported copy is protected
  // by the unchanged data/SEO files below.
  function collectCopy(identifier, seen = new Set()) {
    if (seen.has(identifier)) return;
    seen.add(identifier);
    for (const initializer of declarations.get(identifier) ?? []) {
      function walk(node) {
        if (ts.isStringLiteralLike(node) && /\p{L}/u.test(node.text) && /\s/u.test(node.text)) {
          referencedCopy.add(normalize(node.text));
        }
        if (ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node.parent)) {
          collectCopy(node.text, seen);
        }
        ts.forEachChild(node, walk);
      }
      walk(initializer);
    }
  }
  function expressionText(node, target, follow = true) {
    if (ts.isJsxText(node)) add(target, node.text);
    else if (ts.isStringLiteralLike(node)) add(target, node.text);
    else if (ts.isTemplateExpression(node)) {
      add(target, node.head.text);
      for (const span of node.templateSpans) add(target, span.literal.text);
    }
    if (follow && ts.isIdentifier(node)) collectCopy(node.text);
    // JSX children are visited by the main walker, so do not double-count.
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return;
    ts.forEachChild(node, (child) => expressionText(child, target, follow));
  }
  function headingContent(node) {
    const values = [];
    function walk(child) {
      if (ts.isJsxText(child)) values.push(normalize(child.text));
      else if (ts.isJsxExpression(child) && child.expression) {
        // Wrappers are layout; dynamic heading expressions remain semantic.
        if (ts.isJsxElement(child.expression) || ts.isJsxFragment(child.expression)) walk(child.expression);
        else values.push(printed(child.expression));
        return;
      } else if (ts.isJsxAttribute(child)) {
        if (protectedProps.has(nameOf(child.name)) && child.initializer) values.push(printed(child.initializer));
        return;
      }
      ts.forEachChild(child, walk);
    }
    for (const child of node.children) walk(child);
    return normalize(values.filter(Boolean).join(" "));
  }
  function containsJsx(node) {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node)) return true;
    return ts.forEachChild(node, containsJsx) ?? false;
  }
  function visit(node) {
    if (ts.isJsxText(node)) add(result.text, node.text);
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      expressionText(node.expression, result.text);
      if (!containsJsx(node.expression) && !ts.isStringLiteralLike(node.expression)) {
        add(result.expressions, printed(node.expression));
      }
    }
    if (ts.isJsxAttribute(node)) {
      const name = nameOf(node.name);
      if (linkProps.has(name) && node.initializer) add(result.links, `${name}=${printed(node.initializer)}`);
      if (protectedProps.has(name) && node.initializer) {
        expressionText(node.initializer, result.text);
        if (ts.isJsxExpression(node.initializer) && node.initializer.expression && !containsJsx(node.initializer.expression)) {
          add(result.expressions, `${name}=${printed(node.initializer.expression)}`);
        }
      }
      // Source image descriptions may legitimately change with new media;
      // meaningful alt text remains a rendered accessibility CI requirement.
      if (cosmeticProps.test(name) || name === "alt") return;
    }
    if (ts.isJsxElement(node)) {
      const name = nameOf(node.openingElement.tagName);
      if (/^h[1-6]$/.test(name)) add(result.headings, `${name}: ${headingContent(node)}`);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = nameOf(node.tagName);
      if (/^[A-Z]/.test(name) && !cosmeticComponents.test(name)) add(result.components, name);
    }
    if (ts.isCallExpression(node)) {
      const name = nameOf(node.expression);
      // Request errors are rendered through state rather than JSX literals.
      // Preserve their literal/template copy as well as the visible controls.
      if (name === "setError")
        for (const argument of node.arguments) expressionText(argument, result.text, false);
      if (/^(pageHead|serializeJsonLd|localBusinessJsonLd|redirect|createFileRoute)$/.test(name)) {
        add(result.seo, `${name}(${node.arguments.map(printed).join(", ")})`);
      }
    }
    if (ts.isPropertyAssignment(node) && nameOf(node.name) === "meta") {
      add(result.seo, `meta:${printed(node.initializer)}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const value of referencedCopy) add(result.copy, value);
  return result;
}

function ctaTextNode(source, filename, className) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  const literalAttribute = (node, name) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const attribute = opening.attributes.properties.find((property) =>
      ts.isJsxAttribute(property) && property.name.getText(file) === name,
    );
    return attribute?.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : undefined;
  };
  function visit(node) {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
      && literalAttribute(node, "className")?.split(/\s+/u).includes(className)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (matches.length !== 1) return null;
  const target = matches[0];
  if (!ts.isJsxElement(target) || target.openingElement.tagName.getText(file) !== "Link"
    || literalAttribute(target, "to") !== "/" || literalAttribute(target, "hash") !== "buchung") return null;
  // Both approved controls use direct JSX text and an optional decorative arrow.
  // Extra nested copy cannot turn an otherwise valid label into another CTA.
  if (target.children.some((child) => !ts.isJsxText(child)
    && !(ts.isJsxSelfClosingElement(child) && child.tagName.getText(file) === "IconArrowRight"))) return null;
  const text = target.children.filter((child) => ts.isJsxText(child) && normalize(child.text));
  return text.length === 1 ? text[0] : null;
}

export function compareSource(before, after, filename, { approvedCtaLabels = false } = {}) {
  let expected = before;
  const failures = [];
  const approved = approvedCtaLabels ? APPROVED_CTA_LABELS[filename] : undefined;
  if (approved) {
    const originalLabel = ctaTextNode(before, filename, approved.className);
    const currentLabel = ctaTextNode(after, filename, approved.className);
    if (!originalLabel || normalize(originalLabel.text) !== approved.before) {
      failures.push({ file: filename, kind: "approved-cta", value: `Unique original ${approved.className} label: ${approved.before}`, count: 1 });
    } else {
      expected = before.slice(0, originalLabel.pos) + ` ${approved.after} ` + before.slice(originalLabel.end);
    }
    if (!currentLabel || normalize(currentLabel.text) !== approved.after) {
      failures.push({ file: filename, kind: "approved-cta", value: `Unique approved ${approved.className} label: ${approved.after}`, count: 1 });
    }
  }
  const original = extractContent(expected, filename);
  const changed = extractContent(after, filename);
  return failures.concat(Object.keys(original).flatMap((kind) =>
    missing(original[kind], changed[kind]).map((entry) => ({ file: filename, kind, ...entry })),
  ));
}

export function inspectDesignContent({
  base = DESIGN_BASE,
  cwd = process.cwd(),
  sourceBaselines,
  approvedSeoBlobs,
} = {}) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
  // Resolve once to reject unknown revisions before inspecting any content.
  const commit = git(["rev-parse", "--verify", `${base}^{commit}`]).trim();
  const names = git(["ls-tree", "-r", "--name-only", commit]).split("\n").filter(Boolean);
  const sources = names.filter((name) =>
    /^(src\/components\/.*|src\/routes\/(?!admin(?:\.|\/)|api\.|login\.).*)\.tsx$/.test(name)
    && !/\.test\./.test(name),
  );
  // Custom fixture/repository bases remain self-contained. Only the actual
  // redesign base selects the repository's explicit approved source pins.
  const overrides = sourceBaselines === undefined
    ? (commit === DESIGN_BASE ? APPROVED_SOURCE_BASELINES : {})
    : sourceBaselines;
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
    throw new Error("sourceBaselines must be a map of public source files to immutable commits.");
  const actualSourceBaselines = Object.fromEntries(sources.map((name) => [name, { commit }]));
  for (const [name, baseline] of Object.entries(overrides)) {
    if (!sources.includes(name) || protectedFiles.includes(name))
      throw new Error(`Source baseline must name an unprotected public TSX source: ${name}`);
    if (!baseline || !/^[a-f0-9]{40}$/.test(baseline.commit))
      throw new Error(`Source baseline must use an immutable full commit SHA: ${name}`);
    let resolved;
    try { resolved = git(["rev-parse", "--verify", `${baseline.commit}^{commit}`]).trim(); }
    catch { throw new Error(`Source baseline unavailable for ${name}: ${baseline.commit}. Fetch this exact commit before running the guard.`); }
    actualSourceBaselines[name] = {
      commit: resolved,
      ...(baseline.pullRequest === undefined ? {} : { pullRequest: baseline.pullRequest }),
      ...(baseline.pullRequestUrl === undefined ? {} : { pullRequestUrl: baseline.pullRequestUrl }),
    };
  }
  const protectedPresent = protectedFiles.filter((name) => names.includes(name));
  const seoBlobs = approvedSeoBlobs ?? (commit === DESIGN_BASE ? APPROVED_SEO_BLOBS : {});
  for (const [name, blobId] of Object.entries(seoBlobs)) {
    if ((!sources.includes(name) && !protectedPresent.includes(name)) || !/^[a-f0-9]{40}$/.test(blobId)) {
      throw new Error(`Invalid approved SEO Git blob for ${name}`);
    }
  }
  const failures = [];
  const verifySeoBlob = (name, source) => {
    if (source && sourceBlobId(source) === seoBlobs[name]) return;
    failures.push({ file: name, kind: "seo-source", value: "Source differs from the approved SEO update", count: 1 });
  };
  let textEntries = 0;
  let headingEntries = 0;
  let linkEntries = 0;
  let seoEntries = 0;
  for (const name of sources) {
    const sourceCommit = actualSourceBaselines[name].commit;
    let before;
    try { before = git(["show", `${sourceCommit}:${name}`]); }
    catch { throw new Error(`Source baseline file unavailable: ${sourceCommit}:${name}`); }
    let after;
    try { after = readFileSync(resolve(cwd, name), "utf8"); }
    catch { failures.push({ file: name, kind: "file", value: "Existing source file removed", count: 1 }); continue; }
    const inventory = extractContent(before, name);
    const total = (kind) => [...inventory[kind].values()].reduce((sum, count) => sum + count, 0);
    textEntries += total("text") + total("copy");
    headingEntries += total("headings");
    linkEntries += total("links");
    seoEntries += total("seo");
    if (Object.hasOwn(seoBlobs, name)) verifySeoBlob(name, after);
    else failures.push(...compareSource(before, after, name, { approvedCtaLabels: commit === DESIGN_BASE }));
  }
  for (const name of protectedPresent) {
    let current;
    try { current = readFileSync(resolve(cwd, name), "utf8"); } catch { current = null; }
    if (Object.hasOwn(seoBlobs, name)) verifySeoBlob(name, current);
    else if (current !== git(["show", `${commit}:${name}`])) {
      failures.push({ file: name, kind: "protected-source", value: "Content/SEO source differs from baseline", count: 1 });
    }
  }
  return { base: commit, sourceBaselines: actualSourceBaselines, protectedBase: commit, approvedSeoBlobs: seoBlobs,
    approvedCtaLabels: commit === DESIGN_BASE ? APPROVED_CTA_LABELS : {},
    sourceFiles: sources.length, protectedFiles: protectedPresent.length,
    textEntries, headingEntries, linkEntries, seoEntries, failures, passed: failures.length === 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const base = baseIndex < 0 ? DESIGN_BASE : args[baseIndex + 1];
  if (!base || args.some((arg, index) => arg !== "--base" && !(baseIndex >= 0 && index === baseIndex + 1) && arg !== "--json")) {
    console.error("Usage: node scripts/check-design-content.mjs [--base COMMIT] [--json]");
    process.exitCode = 2;
  } else {
    try {
      const result = inspectDesignContent({ base });
      if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
      else {
        console.log(`Design content guard: ${result.passed ? "PASS" : "FAIL"} against ${result.base}`);
        for (const [file, baseline] of Object.entries(result.sourceBaselines)) {
          if (baseline.commit === result.base && baseline.pullRequest === undefined) continue;
          console.log(`Source baseline: ${file} -> ${baseline.commit}${baseline.pullRequest === undefined ? "" : ` (approved PR #${baseline.pullRequest}: ${baseline.pullRequestUrl})`}`);
        }
        console.log(`Protected data/SEO baseline: ${result.protectedBase}`);
        for (const [file, blobId] of Object.entries(result.approvedSeoBlobs))
          console.log(`Approved SEO source: ${file} -> ${blobId}`);
        for (const [file, label] of Object.entries(result.approvedCtaLabels)) {
          console.log(`Approved CTA label: ${file} .${label.className}: ${JSON.stringify(label.before)} -> ${JSON.stringify(label.after)} (exactly one)`);
        }
        console.log(`${result.sourceFiles} source files, ${result.protectedFiles} protected data/SEO files; ${result.textEntries} text entries, ${result.headingEntries} headings, ${result.linkEntries} links/anchors, ${result.seoEntries} SEO definitions.`);
        for (const failure of result.failures) console.error(`${failure.file} [${failure.kind}] missing ${failure.count} × ${failure.value}`);
      }
      process.exitCode = result.passed ? 0 : 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    }
  }
}
