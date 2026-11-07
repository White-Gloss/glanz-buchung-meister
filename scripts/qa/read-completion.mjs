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
