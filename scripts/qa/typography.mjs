import assert from "node:assert/strict";

// Called only by the existing isolated CI browser suites, after route hydration.
export async function verifyTypography(page, label) {
  const evidence = await page.evaluate(async () => {
    let timer;
    const loaded = await Promise.race([
      (async () => {
        const faces = await Promise.all([
          document.fonts.load('800 48px "Syne"', "Fahrzeugpflege ÄÖÜ 49,00 €"),
          document.fonts.load('400 16px "Plus Jakarta Sans"', "Fahrzeugpflege ÄÖÜ 49,00 €"),
        ]);
        await document.fonts.ready;
        return faces.map((group) => group.map((face) => ({ family: face.family, status: face.status })));
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Local brand fonts did not finish loading within 15s")), 15000); }),
    ]).finally(() => clearTimeout(timer));
    const selectors = {
      body: "body", h1: "h1", h2: "h2", h3: "h3",
      button: "button", label: ".kicker",
      number: ".type-number, .package-price strong, .booking-price strong",
      navigation: ".header-quick-nav a, .film-menu-link, [data-shell='app'] nav a",
      menu: ".film-menu-link",
      input: "input:not([type='checkbox']):not([type='radio']):not([type='hidden']):not([type='button']):not([type='submit']), select, textarea",
      table: "table", footer: "footer",
    };
    const roles = Object.entries(selectors).flatMap(([role, selector]) => {
      const element = document.querySelector(selector);
      if (!element) return [];
      const style = getComputedStyle(element);
      return [{ role, family: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(), weight: style.fontWeight, size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight), spacing: parseFloat(style.letterSpacing), transform: style.textTransform }];
    });
    return {
      width: innerWidth, loaded, roles, status: document.fonts.status,
      checked: [document.fonts.check('800 48px "Syne"'), document.fonts.check('400 16px "Plus Jakarta Sans"')],
      fontRequests: performance.getEntriesByType("resource").map((entry) => entry.name).filter((url) => /\.woff2(?:\?|$)/.test(url)),
      origin: location.origin,
    };
  });
  assert.equal(evidence.status, "loaded", `${label}: document.fonts.ready`);
  assert.deepEqual(evidence.checked, [true, true], `${label}: both brand font families must be usable`);
  for (const [index, family] of ["Syne", "Plus Jakarta Sans"].entries()) {
    assert.ok(evidence.loaded[index].length > 0 && evidence.loaded[index].every((face) => face.family.replace(/["']/g, "") === family && face.status === "loaded"), `${label}: actual ${family} faces must load`);
  }
  for (const url of evidence.fontRequests) assert.equal(new URL(url).origin, evidence.origin, `${label}: fonts stay local`);
  const mobile = evidence.width < 768;
  const expected = {
    body: ["Plus Jakarta Sans", "400", mobile ? 15 : 16],
    h1: ["Syne", "800", mobile ? 34 : 48],
    h2: ["Syne", "700", mobile ? 26 : 32],
    h3: ["Syne", "700", mobile ? 19 : 22],
    button: ["Syne", "700", mobile ? 14 : 15],
    label: ["Syne", "700", mobile ? 11 : 12],
    number: ["Syne", "800", mobile ? 24 : 30],
    navigation: ["Syne", "700", 16],
    menu: ["Syne", "700", 16],
    input: ["Plus Jakarta Sans", "500", mobile ? 16 : 15],
    table: ["Plus Jakarta Sans", "400", mobile ? 13 : 14],
    footer: ["Plus Jakarta Sans", "400", 12],
  };
  for (const role of evidence.roles) {
    assert.deepEqual([role.family, role.weight, role.size], expected[role.role], `${label}: ${role.role} computed typography`);
    if (role.role === "h1") {
      assert.ok(Math.abs(role.lineHeight / role.size - 1.15) < 0.01, `${label}: H1 line-height`);
      assert.equal(role.spacing, -0.5, `${label}: H1 letter-spacing`);
    }
    if (role.role === "h2") assert.ok(Math.abs(role.lineHeight / role.size - 1.25) < 0.01, `${label}: H2 line-height`);
    if (["label", "navigation", "menu"].includes(role.role)) assert.equal(role.transform, "uppercase", `${label}: ${role.role} capitalization`);
  }
  assert.ok(evidence.roles.some(({ role }) => role === "body") && evidence.roles.some(({ role }) => role === "h1"), `${label}: body and title roles must be checked`);
  return { label, ...evidence };
}
