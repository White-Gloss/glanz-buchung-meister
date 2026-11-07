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

/** Scroll through the active input path. A native scrollTo can be overwritten
 * by an in-flight smooth-wheel target, so settle, measure, then wheel again. */
export async function scrollHeroWithWheel(adapter, target, {
  timeoutMs = 10000, tolerance = 1, maxAttempts = 3, now = Date.now, onAttempt = () => {},
} = {}) {
  if (!Number.isFinite(target) || target < 0) throw new Error("A non-negative hero scroll target is required.");
  const deadline = now() + timeoutMs;
  const remaining = () => {
    const budget = deadline - now();
    if (budget <= 0) throw new Error(`Hero wheel scrolling exceeded its ${timeoutMs}ms deadline.`);
    return budget;
  };
  await adapter.settle(remaining());
  for (let index = 0; index <= maxAttempts; index++) {
    remaining();
    const actual = await adapter.readY();
    if (Math.abs(actual - target) <= tolerance) return { target, actual, deadline, attempts: index };
    if (index === maxAttempts) break;
    const attempt = { before: actual, deltaY: target - actual, target };
    onAttempt(attempt);
    await adapter.wheel(attempt.deltaY);
    await adapter.settle(remaining());
    attempt.after = await adapter.readY();
  }
  throw new Error(`Hero wheel scrolling did not reach ${target}px after ${maxAttempts} attempts.`);
}
