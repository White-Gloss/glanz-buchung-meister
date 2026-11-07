// Passed directly to Playwright; keep this function free of module closures.
export function displayedPriceEquals({ selector, expected }) {
  return (document.querySelector(selector)?.textContent ?? "").replace(/\s+/gu, " ").trim() === expected;
}
