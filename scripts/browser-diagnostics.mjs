// Read-only browser diagnostics; importing this module opens no browser or socket.
function evidenceUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "(unknown URL)";
  }
}

export function createBrowserDiagnostics({ origin, label = "" }) {
  const allowedOrigin = new URL(origin).origin;
  const errors = [];
  const blocked = [];
  const ignored = [];
  const abortedRequests = new WeakSet();
  const externalReadUrls = new Set();
  const requestEvidence = (request) => ({
    method: request.method(),
    url: evidenceUrl(request.url()),
    resourceType: request.resourceType(),
  });
  return {
    attach(page) {
      const record = (type, details) => ({ type, label, page: evidenceUrl(page.url()), ...details });
      page.on("pageerror", (error) => errors.push(record("pageerror", { message: error.message })));
      page.on("crash", () => errors.push(record("crash", { message: "Browser page crashed" })));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const location = message.location();
        const evidence = record("console", {
          message: message.text(),
          url: evidenceUrl(location.url),
          line: location.lineNumber,
        });
        // Never hide a generic resource error without its exact blocked URL.
        if (/^Failed to load resource\b/.test(message.text()) && externalReadUrls.has(location.url))
          ignored.push({ ...evidence, reason: "external-read" });
        else errors.push(evidence);
      });
      page.on("response", (response) => {
        if (response.status() >= 400 && !abortedRequests.has(response.request()))
          errors.push(record("http", { ...requestEvidence(response.request()), status: response.status() }));
      });
      page.on("requestfailed", (request) => {
        const evidence = record("requestfailed", { ...requestEvidence(request), message: request.failure()?.errorText });
        if (abortedRequests.has(request)) ignored.push({ ...evidence, reason: "deliberate-block" });
        else errors.push(evidence);
      });
    },
    allowRequest(request) {
      const read = ["GET", "HEAD"].includes(request.method());
      if (read && new URL(request.url()).origin === allowedOrigin) return true;
      const evidence = { label, ...requestEvidence(request), reason: read ? "external-read" : "write" };
      blocked.push(evidence);
      abortedRequests.add(request);
      if (read) externalReadUrls.add(request.url());
      else errors.push({ type: "write", ...evidence, message: "Write request prevented" });
      return false;
    },
    snapshot() { return { errors: [...errors], blocked: [...blocked], ignored: [...ignored] }; },
  };
}

export function assertBrowserDiagnostics(diagnostics) {
  const errors = diagnostics.flatMap((item) => item.snapshot().errors);
  if (errors.length) throw new Error(`Browser diagnostics failed (${errors.length}):\n${JSON.stringify(errors, null, 2)}`);
}
