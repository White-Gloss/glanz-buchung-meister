export async function revealTargetWithWheel(adapter, { maxAttempts = 4, timeoutMs = 10000, now = Date.now, onAttempt = () => {} } = {}) {
  const deadline = now() + timeoutMs;
  const remaining = () => {
    const budget = deadline - now();
    if (budget <= 0) throw new Error("Target scrolling exceeded its deadline");
    return budget;
  };
  await adapter.settle(remaining());
  let geometry;
  for (let index = 0; index <= maxAttempts; index++) {
    remaining();
    geometry = await adapter.measure();
    if (!geometry || ![geometry.top, geometry.bottom, geometry.width, geometry.height, geometry.headerBottom, geometry.viewportHeight].every(Number.isFinite) || geometry.width <= 0 || geometry.height <= 0)
      throw new Error("Scroll target has no measurable bounds");
    const upper = Math.max(0, geometry.headerBottom) + 8;
    const lower = geometry.viewportHeight - 16;
    if (geometry.top >= upper && geometry.bottom <= lower) return { geometry, attempts: index };
    if (index === maxAttempts) break;
    const attempt = { before: geometry, deltaY: (geometry.top + geometry.bottom - upper - lower) / 2 };
    onAttempt(attempt);
    await adapter.wheel(attempt.deltaY);
    await adapter.settle(remaining());
    attempt.after = await adapter.measure();
  }
  throw new Error(`Scroll target is not visible after ${maxAttempts} wheel attempts: ${JSON.stringify(geometry)}`);
}
