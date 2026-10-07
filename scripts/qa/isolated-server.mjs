import { qaBase, controlBase, qaPort, controlPort, tlsPort, lighthouseBase } from "./ports.mjs";
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
// Isolated local verification only; this file is not imported by the application.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(projectRoot);
const outputRoot = resolve(".qa-output");
import { createServer, request } from "node:http";
import { createSecureServer } from "node:http2";
import { execFileSync } from "node:child_process";
import { writeFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash, createHmac, randomBytes, randomUUID, X509Certificate } from "node:crypto";

function proxyHeaders(headers) {
  const hop = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "http2-settings", "te", "trailer", "proxy-authenticate", "proxy-authorization"]);
  for (const name of String(headers.connection || "").split(",")) hop.add(name.trim().toLowerCase());
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !name.startsWith(":") && !hop.has(name.toLowerCase())));
}
process.env.DATABASE_URL = "";
process.env.ALLOW_LOCAL_PGLITE = "1";
process.env.NODE_ENV = "production";
process.env.OPERATOR_ENFORCE = "1";
process.env.BOOKING_OPERATIONS = "bitrix";
process.env.REMINDER_CRON_SECRET = "isolated-qa-cron-secret-32-characters";
process.env.HUB_SYNC_TOKEN = "isolated-qa-hub-sync-token-32-characters";
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
process.env.BETTER_AUTH_URL = qaBase;
process.env.QA_RUN_ID ||= randomUUID();
process.env.PORT = String(qaPort);
process.env.HOST = "127.0.0.1";
process.env.SUPABASE_URL = controlBase;
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-only";
process.env.RESEND_API_KEY = "local-test-only";
process.env.MAIL_FROM = "test@example.invalid";
process.env.OWNER_EMAIL = "owner@example.invalid";
process.env.OWNER_USER_ID = "qa-owner";
process.env.ADMIN_EMAILS = "operator@example.invalid";
process.env.ADMIN_EMAIL = "";
process.env.ADMIN_PROVIDER_ACCOUNTS = "";
process.env.ADMIN_X_ACCOUNT_IDS = "";
process.env.OWNER_X_ACCOUNT_ID = "";
process.env.OWNER_WHATSAPP = "+490000000000";
process.env.OWNER_TELEGRAM = "";
process.env.WHATSAPP_PROVIDER = "meta";
process.env.WHATSAPP_ACCESS_TOKEN = "isolated-qa-not-a-provider-token";
process.env.WHATSAPP_APP_SECRET = "isolated-qa-not-an-app-secret";
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "isolated-qa-not-a-verify-token";
process.env.WHATSAPP_PHONE_NUMBER_ID = "000000000000";
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "000000000000";
process.env.WHATSAPP_API_VERSION = "v99.0";
process.env.WHATSAPP_TEMPLATE_NAME = "isolated_qa_template";
process.env.WHATSAPP_TEMPLATE_LANGUAGE = "de";
process.env.WHATSAPP_TIMEOUT_MS = "1000";
process.env.ADMIN_WHATSAPP_NUMBER = "+490000000000";
const state = {
  mails: [],
  whatsapp: [],
  uploads: [],
  objects: [],
  deletions: [],
  storageAttempts: 0,
  failStorageAt: 0,
  blocked: [],
  failMail: false,
  failWhatsApp: false,
  failStorage: false,
  failCms: false,
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "api.resend.com") {
    state.mails.push(JSON.parse(init.body));
    return Response.json(
      state.failMail
        ? { message: "Simulated mail failure" }
        : { id: `local-mail-${state.mails.length}` },
      { status: state.failMail ? 503 : 200 },
    );
  }
  if (url.origin === "https://graph.facebook.com") {
    if (url.pathname !== "/v99.0/000000000000/messages" || init?.method !== "POST") {
      state.blocked.push(url.origin + url.pathname);
      throw new Error("Unexpected Meta request in isolated verification");
    }
    state.whatsapp.push(JSON.parse(init.body));
    return Response.json(
      state.failWhatsApp
        ? { error: { code: 2, is_transient: true, message: "Simulated provider rejection" } }
        : { messages: [{ id: `local-whatsapp-${state.whatsapp.length}` }] },
      { status: state.failWhatsApp ? 503 : 200 },
    );
  }
  if (url.protocol === "data:" || ["127.0.0.1", "localhost"].includes(url.hostname))
    return originalFetch(input, init);
  state.blocked.push(url.origin + url.pathname);
  throw new Error("External network disabled in isolated verification");
};
await mkdir(outputRoot, { recursive: true });
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, controlBase);
    if (url.pathname === "/identity") {
      res.setHeader("content-type", "application/json");
      res.setHeader("x-qa-run-id", process.env.QA_RUN_ID || "");
      res.end(
        JSON.stringify({ isolated: true, database: "in-memory-pglite", externalFetch: "blocked" }),
      );
      return;
    }
    if (url.pathname === "/storage/v1/object/condition-photos" && req.method === "DELETE") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { prefixes } = JSON.parse(Buffer.concat(chunks));
      state.deletions.push(prefixes);
      state.objects = state.objects.filter((path) => !prefixes.some((p) => path.endsWith("/" + p)));
      res.setHeader("content-type", "application/json");
      res.end("[]");
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/") && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      state.storageAttempts++;
      if (state.failStorage || state.failStorageAt === state.storageAttempts) {
        res.writeHead(503);
        res.end("Simulated storage failure");
        return;
      }
      state.uploads.push({
        path: url.pathname,
        bytes: Buffer.concat(chunks).length,
        mime: req.headers["content-type"],
      });
      state.objects.push(url.pathname);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ Key: url.pathname }));
      return;
    }
    if (url.pathname === "/control" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const flags = JSON.parse(Buffer.concat(chunks));
      for (const key of ["failMail", "failWhatsApp", "failStorage", "failCms"])
        if (typeof flags[key] === "boolean") state[key] = flags[key];
      if (Number.isInteger(flags.failStorageNth))
        state.failStorageAt = flags.failStorageNth
          ? state.storageAttempts + flags.failStorageNth
          : 0;
      const pg = await globalThis.__pgliteInstance__;
      if (flags.createSession) {
        if (req.headers["x-qa-run-id"] !== process.env.QA_RUN_ID) {
          res.writeHead(403);
          res.end("QA run identity required");
          return;
        }
        const fixtures = {
          owner: { id: "qa-owner", email: "owner@example.invalid" },
          operator: { id: "qa-operator", email: "operator@example.invalid" },
          outsider: { id: "qa-outsider", email: "outsider@example.invalid" },
        };
        const fixture = fixtures[flags.createSession];
        if (!fixture || !pg) throw new Error("Unknown fixture or database not ready");
        await pg.query(
          'insert into "user" (id,name,email,"emailVerified","createdAt","updatedAt") values ($1,$2,$3,true,now(),now()) on conflict (id) do nothing',
          [fixture.id, `Isolated ${flags.createSession}`, fixture.email],
        );
        const token = randomBytes(32).toString("base64url");
        await pg.query(
          'insert into "session" (id,"expiresAt",token,"userId","createdAt","updatedAt") values ($1,now()+interval \'1 hour\',$2,$3,now(),now())',
          [randomUUID(), token, fixture.id],
        );
        // Same signature format as installed better-call/crypto; verified by Better Auth.
        const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
          .update(token)
          .digest("base64");
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            userId: fixture.id,
            cookie: `__Host-grok-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`,
          }),
        );
        return;
      }
      if (Number.isInteger(flags.retryBookingId) && flags.retryBookingId > 0) {
        if (req.headers["x-qa-run-id"] !== process.env.QA_RUN_ID) {
          res.writeHead(403);
          res.end("QA run identity required");
          return;
        }
        await pg.query(
          "update outbound_queue set next_attempt_at=now() where booking_id=$1 and status='queued' and attempt_count>0 and last_error_code is not null",
          [flags.retryBookingId],
        );
      }
      if (pg && !pg.__qaWrapped) {
        const query = pg.query.bind(pg);
        pg.query = (text, ...args) => {
          if (
            state.failCms &&
            /select slug, created_at, updated_at from cms_items/i.test(text.replace(/\s+/g, " "))
          )
            return Promise.reject(new Error("Simulated CMS failure"));
          return query(text, ...args);
        };
        pg.__qaWrapped = true;
      }
      res.end("ok");
      return;
    }
    if (url.pathname === "/cms-fixture" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { published } = JSON.parse(Buffer.concat(chunks));
      const pg = await globalThis.__pgliteInstance__;
      await pg.query("delete from cms_items where slug in ('qa-sitemap-round2','qa-draft-round2')");
      await pg.query(
        "insert into cms_items(shop_id,kind,slug,title,body,extra,published,sort) values ('white-gloss','blog','qa-sitemap-round2','QA Sitemap Test','Lokaler Prüfartikel.','{}',$1,0),('white-gloss','blog','qa-draft-round2','QA Entwurf','Nicht veröffentlicht.','{}',false,0)",
        [Boolean(published)],
      );
      res.end("ok");
      return;
    }
    if (url.pathname === "/evidence") {
      const pg = await globalThis.__pgliteInstance__;
      const tables = {};
      for (const table of [
        "bookings",
        "customers",
        "inbox_messages",
        "outbound_queue",
        "booking_photos",
        "booking_events",
      ]) {
        tables[table] = pg
          ? (await pg.query(`select * from ${table} order by id`)).rows.map(
              ({ upload_token_hash, request_key_hash, request_fingerprint, ...row }) => row,
            )
          : [];
      }
      const webhookReceiptCount = pg
        ? (await pg.query("select count(*)::int as n from whatsapp_webhook_receipts")).rows[0].n
        : 0;
      const evidence = { ...state, tables, webhookReceiptCount };
      await writeFile(resolve(outputRoot, "flow-data.json"), JSON.stringify(evidence, null, 2));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(evidence));
      return;
    }
    res.writeHead(404);
    res.end();
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
}).listen(controlPort, "127.0.0.1");

// Same guarded process and unchanged Nitro build; only Lighthouse uses TLS/H2.
const tlsDirectory = await mkdtemp(resolve(outputRoot, "lighthouse-tls-"));
const keyPath = resolve(tlsDirectory, "key.pem");
const certificatePath = resolve(tlsDirectory, "cert.pem");
let tlsServer;
let certificate;
try {
  try {
    execFileSync("openssl", ["version"], { timeout: 5_000, stdio: "pipe" });
  } catch (error) {
    throw new Error("OpenSSL must be installed on the isolated Linux CI runner for Lighthouse TLS.", { cause: error });
  }
  const previousUmask = process.umask(0o077);
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-noenc", "-sha256", "-days", "1",
      "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost",
      "-keyout", keyPath, "-out", certificatePath], { timeout: 10_000, stdio: "pipe" });
  } finally {
    process.umask(previousUmask);
  }
  certificate = new X509Certificate(await readFile(certificatePath));
  tlsServer = createSecureServer({ key: await readFile(keyPath), cert: await readFile(certificatePath), allowHTTP1: false }, (req, res) => {
    const runId = process.env.QA_RUN_ID;
    res.setHeader("x-qa-run-id", runId);
    if (typeof req.url !== "string" || !req.url.startsWith("/") || req.url.startsWith("//")) {
      res.writeHead(400);
      res.end("An origin-form request path is required");
      return;
    }
    if (req.method === "GET" && req.url === "/__qa/h2-identity") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ runId, protocol: "h2" }));
      return;
    }
    // The destination is constant; incoming URLs are used only as request paths.
    const upstream = request(qaBase, { method: req.method, path: req.url, headers: {
      ...proxyHeaders(req.headers), host: new URL(qaBase).host,
      "x-forwarded-host": "white-gloss.de", "x-forwarded-proto": "https",
    } }, (response) => {
      if (res.destroyed) return response.destroy();
      res.writeHead(response.statusCode, { ...proxyHeaders(response.headers), "x-qa-run-id": runId });
      response.on("error", () => res.destroy());
      response.pipe(res);
    });
    upstream.on("error", () => {
      if (res.destroyed) return;
      if (res.headersSent) return res.destroy();
      res.writeHead(502);
      res.end("Isolated upstream unavailable");
    });
    req.on("aborted", () => upstream.destroy());
    req.on("error", () => upstream.destroy());
    res.on("close", () => upstream.destroy());
    res.on("error", () => upstream.destroy());
    req.pipe(upstream);
  });
} finally {
  // Node has loaded the key into its TLS context; never retain it in CI artifacts.
  await rm(keyPath, { force: true });
}
tlsServer.on("error", (error) => { throw error; });
await new Promise((ready) => tlsServer.listen({ port: tlsPort, host: "127.0.0.1", exclusive: true }, ready));
await writeFile(resolve(outputRoot, "lighthouse-transport.json"), JSON.stringify({
  runId: process.env.QA_RUN_ID, origin: lighthouseBase, port: tlsPort,
  spkiPin: createHash("sha256").update(certificate.publicKey.export({ type: "spki", format: "der" })).digest("base64"),
  certificatePath, protocol: "h2",
}, null, 2));
await import("../../.output/server/index.mjs");
