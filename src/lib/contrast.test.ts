import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { contrastRatio, SURFACE } from "./contrast.ts";

const cssPath = fileURLToPath(new URL("../styles.css", import.meta.url));

function token(name: string) {
  const css = readFileSync(cssPath, "utf8");
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `CSS-Token --color-${name} fehlt`);
  return match[1];
}

describe("public text contrast WCAG 2.2 AA", () => {
  it("keeps the editorial public palette readable on every public surface", () => {
    const css = readFileSync(new URL("../styles/studio.css", import.meta.url), "utf8");
    const publicToken = (name: string) => {
      const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
      assert.ok(match, `Public CSS token ${name} missing`);
      return match[1];
    };
    for (const name of ["fg", "muted", "subtle"]) {
      for (const surface of ["bg", "surface", "elevated"]) {
        assert.ok(contrastRatio(publicToken(name), publicToken(surface)) >= 4.5,
          `${name} must remain readable on ${surface}`);
      }
    }
    assert.ok(contrastRatio(publicToken("accent-fg"), publicToken("accent")) >= 4.5);
  });

  it("keeps danger, muted and subtle above 4.5:1 on all dark surfaces", () => {
    const fg = {
      danger: token("danger"),
      muted: token("muted"),
      subtle: token("subtle"),
      fg: token("fg"),
    };
    for (const [name, color] of Object.entries(fg)) {
      for (const [surfaceName, bg] of Object.entries(SURFACE)) {
        const ratio = contrastRatio(color, bg);
        assert.ok(
          ratio >= 4.5,
          `${name} ${color} on ${surfaceName} ${bg} = ${ratio.toFixed(2)}:1`,
        );
      }
    }
  });

  it("uses the documented dark surfaces in CSS", () => {
    assert.equal(token("bg"), SURFACE.bg);
    assert.equal(token("surface"), SURFACE.surface);
    assert.equal(token("elevated"), SURFACE.elevated);
  });
});
