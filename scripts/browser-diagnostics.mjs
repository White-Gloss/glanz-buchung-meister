// Read-only browser diagnostics; importing this module opens no browser or socket.
function evidenceUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "(unknown URL)";
  }
}

// Match complete, observed Firefox/WebKit messages only. A Report-Only header
// does not enforce CSP. Keep these visible in reports; enforced violations,
// unfamiliar wording, page exceptions and failed requests still fail the gate.
function reportOnlyWarning(text) {
  if (/^\[JavaScript Error: "Content-Security-Policy: \(Report-Only policy\) The page’s settings would block a script \(script-src-elem\) at https?:\/\/[^\s"<>]+ from being executed because it violates the following directive: “script-src [^”\r\n]+”" \{file: "https?:\/\/[^"\r\n]+" line: \d+\}\]$/.test(text) ||
      /^\[Report Only\] Refused to load https?:\/\/[^\s"<>]+ because it does not appear in the script-src directive of the Content Security Policy\.$/.test(text))
    return "csp-report-only-violation";
  if (/^The Content Security Policy '[^\r\n]+' was delivered in report-only mode, but does not specify a 'report-to'; the policy will have no effect\. Please either add a 'report-to' directive, or deliver the policy via the 'Content-Security-Policy' header\.$/.test(text))
    return "csp-report-only-missing-endpoint";
  return null;
}

export function createBrowserDiagnostics({ origin, label = "" }) {
  const allowedOrigin = new URL(origin).origin;
  const errors = [];
  const warnings = [];
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
        if (!["error", "warning"].includes(message.type())) return;
        const location = message.location();
        const evidence = record("console", {
          message: message.text(),
          url: evidenceUrl(location.url),
          line: location.lineNumber,
        });
        const policyWarning = reportOnlyWarning(message.text());
        if (policyWarning) {
          warnings.push({ ...evidence, reason: policyWarning });
          return;
        }
        if (message.type() !== "error") return;
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
    snapshot() { return { errors: [...errors], warnings: [...warnings], blocked: [...blocked], ignored: [...ignored] }; },
  };
}

export function assertBrowserDiagnostics(diagnostics) {
  const errors = diagnostics.flatMap((item) => item.snapshot().errors);
  if (errors.length) throw new Error(`Browser diagnostics failed (${errors.length}):\n${JSON.stringify(errors, null, 2)}`);
}
