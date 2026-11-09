export async function revealTargetWithWheel(adapter, { maxAttempts, timeoutMs = 10000, now = Date.now, onAttempt = () => {} } = {}) {
  const deadline = now() + timeoutMs;
  const remaining = () => {
    const budget = deadline - now();
    if (budget <= 0) throw new Error("Target scrolling exceeded its deadline");
    return budget;
  };
  await adapter.settle(remaining());
  let geometry;
  let attemptLimit = maxAttempts;
  let stalledAttempts = 0;
  for (let index = 0; ; index++) {
    remaining();
    geometry = await adapter.measure();
    if (!geometry || ![geometry.top, geometry.bottom, geometry.width, geometry.height, geometry.headerBottom, geometry.viewportHeight, geometry.scrollY].every(Number.isFinite) || geometry.width <= 0 || geometry.height <= 0)
      throw new Error("Scroll target has no measurable bounds");
    const upper = Math.max(0, geometry.headerBottom) + 8;
    const lower = geometry.viewportHeight - 16;
    if (geometry.top >= upper && geometry.bottom <= lower) return { geometry, attempts: index };
    const distance = (geometry.top + geometry.bottom - upper - lower) / 2;
    const step = (lower - upper) * 0.9;
    if (step <= 0) throw new Error("Scroll target has no usable viewport");
    // Firefox caps giant wheel input near one viewport. Use smaller input and
    // derive the bounded step budget from the real distance, not a fixed count.
    // Two extra steps allow one reset and a final position correction.
    attemptLimit ??= Math.ceil(Math.abs(distance) / step) + 2;
    if (index === attemptLimit) break;
    const attempt = { before: geometry, deltaY: Math.sign(distance) * Math.min(Math.abs(distance), step) };
    onAttempt(attempt);
    await adapter.wheel(attempt.deltaY);
    await adapter.settle(remaining());
    attempt.after = await adapter.measure();
    stalledAttempts = Math.abs(attempt.after.scrollY - geometry.scrollY) <= 0.5 ? stalledAttempts + 1 : 0;
    if (stalledAttempts >= 3) throw new Error("Scroll target is not visible: no scroll progress after three consecutive wheel attempts");
  }
  throw new Error(`Scroll target is not visible after ${attemptLimit} wheel attempts: ${JSON.stringify(geometry)}`);
}
