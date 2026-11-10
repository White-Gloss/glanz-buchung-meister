#!/usr/bin/env node
/**
 * Read-only source guard for a visual-only redesign. No server or build needed.
 *
 * It compares the working tree with a Git commit, not with snapshots silently
 * updated by the build. Source checks complement (and do not replace) rendered
 * CI checks: CSS visibility, live CMS content and runtime layout need a browser.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const DESIGN_BASE = "db305e3c190cf53a0213c90ea3e788625ece091d";
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

export function compareSource(before, after, filename) {
  const original = extractContent(before, filename);
  const changed = extractContent(after, filename);
  return Object.keys(original).flatMap((kind) =>
    missing(original[kind], changed[kind]).map((entry) => ({ file: filename, kind, ...entry })),
  );
}

export function inspectDesignContent({ base = DESIGN_BASE, cwd = process.cwd() } = {}) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  // Resolve once to reject unknown revisions before inspecting any content.
  const commit = git(["rev-parse", "--verify", `${base}^{commit}`]).trim();
  const names = git(["ls-tree", "-r", "--name-only", commit]).split("\n").filter(Boolean);
  const sources = names.filter((name) =>
    /^(src\/components\/.*|src\/routes\/(?!admin(?:\.|\/)|api\.|login\.).*)\.tsx$/.test(name)
    && !/\.test\./.test(name),
  );
  const failures = [];
  let textEntries = 0;
  let headingEntries = 0;
  let linkEntries = 0;
  let seoEntries = 0;
  for (const name of sources) {
    const before = git(["show", `${commit}:${name}`]);
    let after;
    try { after = readFileSync(resolve(cwd, name), "utf8"); }
    catch { failures.push({ file: name, kind: "file", value: "Existing source file removed", count: 1 }); continue; }
    const inventory = extractContent(before, name);
    const total = (kind) => [...inventory[kind].values()].reduce((sum, count) => sum + count, 0);
    textEntries += total("text") + total("copy");
    headingEntries += total("headings");
    linkEntries += total("links");
    seoEntries += total("seo");
    failures.push(...compareSource(before, after, name));
  }
  const protectedPresent = protectedFiles.filter((name) => names.includes(name));
  for (const name of protectedPresent) {
    let current;
    try { current = readFileSync(resolve(cwd, name), "utf8"); } catch { current = null; }
    if (current !== git(["show", `${commit}:${name}`])) {
      failures.push({ file: name, kind: "protected-source", value: "Content/SEO source differs from baseline", count: 1 });
    }
  }
  return { base: commit, sourceFiles: sources.length, protectedFiles: protectedPresent.length,
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
