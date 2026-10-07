import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  applySecurityHeaders,
  createScriptNonce,
  inlineScriptHashes,
  securityHeaderEntries,
} from "../server/security-headers.ts";
import { responseCacheControl } from "../server/cache-policy.ts";
import { renderInstallPage } from "./grok-pwa-plugin.mjs";
import {
  acceptsHtml,
  isDocumentPath,
  isInstallQuery,
  renderInstallPageHtml,
} from "./grok-pwa-shared.mjs";

function sourceFile(relativePath) {
  const text = readFileSync(new URL(relativePath, new URL("../", import.meta.url)), "utf8");
  return ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(source, predicate) {
  let result;
  function visit(node) {
    if (!result && predicate(node)) result = node;
    if (!result) ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(result, "Expected actual production callback is present");
  return result;
}
function execute(node, source, scope) {
  const actual = node
    .getText(source)
    .replace(/^export default\s+/, "")
    .replace(/^export\s+/, "")
    .replaceAll("import.meta.env.PROD", "production");
  const code = ts.transpileModule(`const actual = ${actual}; actual;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return runInNewContext(code, scope);
}

function policy(mode) {
  return new Headers(securityHeaderEntries(mode));
}

test("production script policy requires nonce/hash, retains required media and tag sources", () => {
  const nonce = createScriptNonce();
  const headers = policy({ allowFraming: false, hsts: true, nonce });
  const enforced = headers.get("content-security-policy");
  const trial = headers.get("content-security-policy-report-only");
  for (const csp of [enforced, trial]) {
    const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src"));
    assert.ok(!scriptSrc.includes("'unsafe-inline'"));
    assert.ok(scriptSrc.includes(`'nonce-${nonce}'`));
    assert.ok(scriptSrc.includes("https://www.googletagmanager.com"));
    assert.match(csp, /media-src 'self' blob:/);
    assert.match(csp, /worker-src 'self' blob:/);
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  }
  assert.equal(headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(
    headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains; preload",
  );
});

test("framed preview retains its inline/bootstrap allowance and has no COOP or HSTS", () => {
  const headers = policy({ allowFraming: true, hsts: false });
  assert.match(headers.get("content-security-policy"), /script-src[^;]*'unsafe-inline'/);
  assert.match(headers.get("content-security-policy"), /frame-ancestors \*/);
  assert.equal(headers.get("cross-origin-opener-policy"), null);
  assert.equal(headers.get("strict-transport-security"), null);
  assert.equal(headers.get("x-frame-options"), null);
});

test("CSP rejects nonce and hash values that could inject policy directives", () => {
  assert.throws(() => policy({ allowFraming: false, hsts: true, nonce: "bad'; script-src *" }));
  assert.throws(() =>
    policy({ allowFraming: false, hsts: true, scriptHashes: ["bad'; script-src *"] }),
  );
});

test("the real router nonce setup isolates every SSR request and leaves preview unchanged", () => {
  const source = sourceFile("src/router.tsx");
  const setup = find(
    source,
    (node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "server" &&
      node.arguments[0]?.getText(source).includes("createScriptNonce"),
  );
  const scope = {
    production: true,
    createScriptNonce,
  };
  const prepare = execute(setup.arguments[0], source, scope);
  const declaration = find(
    source,
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "getRouter",
  );
  const getRouter = execute(declaration, source, {
    createRouter: (options) => options,
    routeTree: {},
    NotFoundComponent() {},
    AppErrorComponent() {},
    prepareRequestNonce: prepare,
  });
  const first = getRouter().ssr.nonce;
  const second = getRouter().ssr.nonce;
  assert.notEqual(first, second);
  assert.equal(Buffer.from(first, "base64").length, 32);
  assert.equal(Buffer.from(second, "base64").length, 32);
  assert.equal(execute(setup.arguments[0], source, { ...scope, production: false })(), undefined);
});

test("the real Start render callback keeps its request nonce on 200 and 404 streams", async () => {
  const source = sourceFile("src/server.ts");
  const handler = find(
    source,
    (node) => ts.isCallExpression(node) && node.expression.getText(source) === "createStartHandler",
  );
  for (const status of [200, 404]) {
    const nonce = createScriptNonce();
    const payload = new TextEncoder().encode(`<script nonce="${nonce}">window.ready=true</script>`);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      },
    });
    const callback = execute(handler.arguments[0], source, {
      production: true,
      applySecurityHeaders,
      defaultStreamHandler: (context) =>
        new Response(stream, { status, headers: context.responseHeaders }),
    });
    const response = callback({
      router: { options: { ssr: { nonce } } },
      responseHeaders: new Headers(),
    });
    assert.equal(response.status, status);
    assert.equal(response.body, stream);
    assert.ok(response.headers.get("content-security-policy").includes(`'nonce-${nonce}'`));
    assert.equal(await response.text(), new TextDecoder().decode(payload));
  }
});

test("Nitro middleware keeps the renderer nonce while adding headers and HTML cache policy", async () => {
  const source = sourceFile("server/middleware/security-headers.ts");
  const declaration = find(
    source,
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "securityHeadersMiddleware",
  );
  const middleware = execute(declaration, source, { applySecurityHeaders, responseCacheControl });
  const nonce = createScriptNonce();
  const response = new Response("HTML", {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": `script-src 'self' 'nonce-${nonce}'`,
    },
  });
  const result = await middleware(
    { url: { pathname: "/" }, req: { method: "GET" } },
    () => response,
  );
  assert.equal(result, response);
  assert.ok(result.headers.get("content-security-policy").includes(`'nonce-${nonce}'`));
  assert.ok(result.headers.get("content-security-policy-report-only").includes(`'nonce-${nonce}'`));
  assert.equal(result.headers.get("cache-control"), "public, max-age=0, must-revalidate");
});

test("installer hashes use browser-normalized script text and ignore external or JSON scripts", () => {
  const crlf = '<script>\r\nconsole.log("x");\r\n</script>';
  const lf = crlf.replaceAll("\r\n", "\n");
  assert.deepEqual(inlineScriptHashes(crlf), inlineScriptHashes(lf));
  assert.deepEqual(
    inlineScriptHashes(
      `${lf}<script src="/external.js"></script><script type="application/ld+json">{}</script>`,
    ),
    inlineScriptHashes(lf),
  );
  const hashes = inlineScriptHashes(
    renderInstallPage("white-gloss.de", "/?install=1&platform=ios"),
  );
  assert.equal(hashes.length, 1);
  assert.equal(hashes[0], "sha256-NsbLPjQnXSUWeMvQnU5FNZMktRjDX9FGWc0Z8gNIN3Y=");
});

test("production installer supplies a static hash policy even when it bypasses downstream middleware", async () => {
  const source = sourceFile("server/middleware/grok-pwa.ts");
  const declaration = find(
    source,
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "grokPwaMiddleware",
  );
  const middleware = execute(declaration, source, {
    Response,
    Headers,
    acceptsHtml,
    isDocumentPath,
    isInstallQuery,
    renderInstallPageHtml,
    installPageTemplate: readFileSync(new URL("./install-page.html", import.meta.url), "utf8"),
    requestHost: (event) => event.req.headers.get("host"),
    applySecurityHeaders,
    inlineScriptHashes,
    gzipHtml: (response) => response,
  });
  const response = await middleware(
    {
      url: new URL("https://white-gloss.de/?install=1&platform=ios"),
      req: { method: "GET", headers: new Headers({ host: "white-gloss.de", accept: "text/html" }) },
    },
    () => assert.fail("Installer must not invoke downstream SSR"),
  );
  const html = await response.text();
  const csp = response.headers.get("content-security-policy");
  assert.ok(csp.includes(`'${inlineScriptHashes(html)[0]}'`));
  assert.ok(
    !csp
      .split(";")
      .find((part) => part.trim().startsWith("script-src"))
      .includes("'unsafe-inline'"),
  );
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(
    response.headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains; preload",
  );
});
