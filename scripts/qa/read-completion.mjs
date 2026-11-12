import assert from "node:assert/strict";

export async function observeReadDuringAction(page, predicate, action, { timeoutMs = 15000 } = {}) {
  let timer;
  let onResponse;
  const observed = new Promise((resolve) => {
    onResponse = (response) => { if (predicate(response)) resolve(response); };
    page.on("response", onResponse);
  });
  try {
    // Navigation, images and the lazy section each have their own UI deadline.
    // An unrelated earlier response timeout must not mask that action's error.
    await action();
    return await Promise.race([
      observed,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Expected browser read was not observed after the UI became ready")), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); page.off("response", onResponse); }
}

export async function completeSuccessfulRead(response, { timeoutMs = 15000 } = {}) {
  assert.equal(response.status(), 200, "The observed browser read must succeed");
  let timer;
  try {
    const failure = await Promise.race([
      response.finished(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Observed browser read did not finish before navigation")), timeoutMs); }),
    ]);
    if (failure) throw failure;
    return { status: response.status(), finished: true };
  } finally { clearTimeout(timer); }
}

export function observePageReads(page, origin) {
  const allowedOrigin = new URL(origin).origin;
  const pending = new Set();
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).origin === allowedOrigin &&
        ["script", "stylesheet", "fetch", "xhr", "image"].includes(request.resourceType())) pending.add(request);
  });
  page.on("requestfinished", (request) => pending.delete(request));
  // The independent browser diagnostics still records every failed request.
  page.on("requestfailed", (request) => pending.delete(request));
  return {
    async complete(label, { timeoutMs = 15000 } = {}) {
      let timer;
      const completed = [];
      try {
        await Promise.race([
          (async () => {
            while (pending.size) {
              await Promise.all([...pending].map(async (request) => {
                const response = await request.response();
                assert.ok(response, `${label}: a started page read must receive a response`);
                const completion = await completeSuccessfulRead(response, { timeoutMs });
                completed.push({ path: new URL(request.url()).pathname, ...completion });
                pending.delete(request);
              }));
            }
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label}: page reads did not finish before navigation: ${[...pending].map((request) => new URL(request.url()).pathname).join(", ")}`)), timeoutMs);
          }),
        ]);
        return { label, completed, pending: pending.size };
      } finally { clearTimeout(timer); }
    },
  };
}
