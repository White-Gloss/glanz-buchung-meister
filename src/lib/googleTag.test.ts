import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_GOOGLE_ADS_ID,
  __resetGoogleTagStateForTests,
  loadGoogleTag,
  resolveGa4MeasurementId,
  resolveGoogleAdsId,
  trackGoogleAdsConversion,
} from "./googleTag.ts";

/**
 * `loadGoogleTag` greift auf `window`/`document` zu. Im Node-Testkontext
 * gibt es keinen echten Browser — ein minimaler Fake genügt, um zu prüfen,
 * dass das Skript erst nach Aufruf (also nach Einwilligung) angehängt wird
 * und danach `window.gtag` existiert.
 */
function installFakeBrowser() {
  const appendedScripts: { src: string; async: boolean }[] = [];

  const fakeDocument = {
    createElement: (tag: string) => {
      assert.equal(tag, "script");
      const el = {
        src: "",
        async: false,
      };
      return el as unknown as HTMLScriptElement;
    },
    head: {
      appendChild: (el: { src: string; async: boolean }) => {
        appendedScripts.push({ src: el.src, async: el.async });
      },
    },
  };

  const fakeWindow = {
    dataLayer: undefined as unknown[] | undefined,
    gtag: undefined as ((...args: unknown[]) => void) | undefined,
  };

  (globalThis as { window?: unknown }).window = fakeWindow;
  (globalThis as { document?: unknown }).document = fakeDocument;

  return { appendedScripts, fakeWindow };
}

function uninstallFakeBrowser() {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: unknown }).document;
  __resetGoogleTagStateForTests();
}

describe("resolveGoogleAdsId", () => {
  it("liefert ohne Wert oder bei leerem String die Standard-ID", () => {
    assert.equal(resolveGoogleAdsId(""), DEFAULT_GOOGLE_ADS_ID);
    assert.equal(resolveGoogleAdsId(undefined), DEFAULT_GOOGLE_ADS_ID);
    assert.equal(resolveGoogleAdsId(null), DEFAULT_GOOGLE_ADS_ID);
    assert.equal(resolveGoogleAdsId("   "), DEFAULT_GOOGLE_ADS_ID);
  });

  it("akzeptiert eine gültige Google Ads ID unverändert", () => {
    assert.equal(resolveGoogleAdsId("AW-18384520682"), "AW-18384520682");
    assert.equal(resolveGoogleAdsId("  AW-999999999  "), "AW-999999999");
  });

  it("erlaubt explizite Deaktivierung mit off, false, none oder 0", () => {
    assert.equal(resolveGoogleAdsId("off"), null);
    assert.equal(resolveGoogleAdsId("false"), null);
    assert.equal(resolveGoogleAdsId("none"), null);
    assert.equal(resolveGoogleAdsId("0"), null);
  });

  it("filtert die ID aus einem versehentlich komplett kopierten Skript-Tag heraus", () => {
    const htmlSnippet = `
      <!-- Google tag (gtag.js) -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18384520682">
      </script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'AW-18384520682');
      </script>
    `;
    assert.equal(resolveGoogleAdsId(htmlSnippet), "AW-18384520682");
  });
});

describe("trackGoogleAdsConversion", () => {
  it("bricht sicher ab, wenn window oder gtag nicht existieren", () => {
    // Im Node-Testkontext gibt es kein window.gtag
    const result = trackGoogleAdsConversion();
    assert.equal(result, false);
  });
});

describe("resolveGa4MeasurementId", () => {
  it("liefert null ohne Wert — anders als bei Ads gibt es keine Standard-ID", () => {
    assert.equal(resolveGa4MeasurementId(""), null);
    assert.equal(resolveGa4MeasurementId(undefined), null);
    assert.equal(resolveGa4MeasurementId(null), null);
  });

  it("akzeptiert eine gültige GA4-Mess-ID", () => {
    assert.equal(resolveGa4MeasurementId("G-RFX3GFRVBG"), "G-RFX3GFRVBG");
    assert.equal(resolveGa4MeasurementId("  G-RFX3GFRVBG  "), "G-RFX3GFRVBG");
  });

  it("lehnt ungültige Werte ab und erlaubt explizite Deaktivierung", () => {
    assert.equal(resolveGa4MeasurementId("off"), null);
    assert.equal(resolveGa4MeasurementId("false"), null);
    assert.equal(resolveGa4MeasurementId("AW-18384520682"), null);
  });
});

describe("loadGoogleTag", () => {
  afterEach(() => {
    uninstallFakeBrowser();
  });

  it("lädt ohne window kein Skript", () => {
    const result = loadGoogleTag({ adsId: DEFAULT_GOOGLE_ADS_ID });
    assert.equal(result, false);
  });

  it("hängt ohne konfigurierte IDs kein Skript an", () => {
    const { appendedScripts } = installFakeBrowser();
    const result = loadGoogleTag({ adsId: null, ga4Id: null });
    assert.equal(result, false);
    assert.equal(appendedScripts.length, 0);
  });

  it("hängt gtag.js für Google Ads an und setzt window.gtag", () => {
    const { appendedScripts, fakeWindow } = installFakeBrowser();
    const result = loadGoogleTag({ adsId: DEFAULT_GOOGLE_ADS_ID, ga4Id: null });

    assert.equal(result, true);
    assert.equal(appendedScripts.length, 1);
    assert.match(appendedScripts[0].src, /googletagmanager\.com\/gtag\/js\?id=AW-18384520682/);
    assert.equal(typeof fakeWindow.gtag, "function");
  });

  it("hängt das Skript nur einmal an, auch bei wiederholtem Aufruf", () => {
    const { appendedScripts } = installFakeBrowser();
    loadGoogleTag({ adsId: DEFAULT_GOOGLE_ADS_ID, ga4Id: null });
    loadGoogleTag({ adsId: DEFAULT_GOOGLE_ADS_ID, ga4Id: null });

    assert.equal(appendedScripts.length, 1);
  });

  it("funktioniert mit GA4 allein, wenn Ads deaktiviert ist", () => {
    const { appendedScripts } = installFakeBrowser();
    const result = loadGoogleTag({ adsId: null, ga4Id: "G-RFX3GFRVBG" });

    assert.equal(result, true);
    assert.match(appendedScripts[0].src, /id=G-RFX3GFRVBG/);
  });

  it("macht trackGoogleAdsConversion nach dem Laden nutzbar", () => {
    installFakeBrowser();
    loadGoogleTag({ adsId: DEFAULT_GOOGLE_ADS_ID, ga4Id: null });

    const result = trackGoogleAdsConversion({ adsId: DEFAULT_GOOGLE_ADS_ID, label: "" });
    assert.equal(result, true);
  });
});
