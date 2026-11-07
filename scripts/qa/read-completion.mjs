import assert from "node:assert/strict";

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
