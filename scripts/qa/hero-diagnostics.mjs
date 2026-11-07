// Pure evidence helpers; importing them starts no browser, server or network request.
export function heroEvidenceUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "blob:") return `blob:${url.origin}/[object-url]`;
    if (url.protocol === "data:") return "data:[redacted]";
    if (url.protocol === "file:") return `file://${url.pathname}`;
    if (!["http:", "https:"].includes(url.protocol)) return `${url.protocol}[redacted]`;
    return `${url.origin}${url.pathname}`;
  } catch { return "[unparseable-url]"; }
}

function redactText(value) {
  return value.replace(/(?:blob:)?https?:\/\/[^\s"'<>),]+|file:\/\/[^\s"'<>),]+|data:[^\s"'<>),]+/g, heroEvidenceUrl);
}

export function redactHeroEvidence(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactHeroEvidence);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactHeroEvidence(entry)]));
  return value;
}

export function createHeroPhaseTracker(result, { now = Date.now, log = console.log } = {}) {
  result.phases = [];
  return {
    async run(name, work) {
      result.phase = name;
      const phase = { name, startedAt: now(), status: "running" };
      result.phases.push(phase);
      log(`[hero:${result.viewport?.name ?? "scenario"}] ${name}: started`);
      try {
        const value = await work();
        phase.status = "passed";
        return value;
      } catch (error) {
        phase.status = "failed";
        phase.error = redactHeroEvidence({ name: error.name, message: error.message, stack: error.stack });
        log(`[hero:${result.viewport?.name ?? "scenario"}] ${name}: failed ${JSON.stringify(phase.error)}`);
        throw error;
      } finally {
        phase.durationMs = now() - phase.startedAt;
      }
    },
  };
}
