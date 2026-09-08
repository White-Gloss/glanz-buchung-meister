import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  queueBookingConversion,
  clearPendingBookingConversions,
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

  const storage = new Map<string, string>([["wg-consent", "accepted"]]);
  const fakeWindow = {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null },
    dataLayer: undefined as unknown[] | undefined,
    gtag: undefined as ((...args: unknown[]) => void) | undefined,
  };

  (globalThis as { window?: unknown }).window = fakeWindow;
  (globalThis as { document?: unknown }).document = fakeDocument;

  return { appendedScripts, fakeWindow, storage };
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

    const result = trackGoogleAdsConversion({
      adsId: DEFAULT_GOOGLE_ADS_ID,
      label: "c4P4CLfJue0cEOqLtr5E",
    });
    assert.equal(result, true);
  });
});

describe("booking conversion lifecycle", () => {
  afterEach(uninstallFakeBrowser);
  const conversions = () =>
    ((window.dataLayer as unknown[][]) ?? []).filter((row) => row[0] === "event");

  it("sends one EUR lead after server success, with a stable transaction ID", () => {
    installFakeBrowser();
    loadGoogleTag();
    assert.equal(conversions().length, 0);
    queueBookingConversion("WG-123");
    queueBookingConversion("WG-123");
    loadGoogleTag();
    assert.deepEqual(conversions(), [
      [
        "event",
        "conversion",
        {
          send_to: "AW-18384520682/c4P4CLfJue0cEOqLtr5E",
          value: 1,
          currency: "EUR",
          transaction_id: "WG-123",
        },
      ],
    ]);
    queueBookingConversion("WG-124");
    assert.equal(conversions().length, 2);
  });

  it("waits for late consent and does not send on a fresh page load", () => {
    const { storage, appendedScripts } = installFakeBrowser();
    storage.clear();
    queueBookingConversion("WG-123");
    assert.equal(appendedScripts.length, 0);
    assert.equal(conversions().length, 0);
    storage.set("wg-consent", "accepted");
    loadGoogleTag();
    assert.equal(conversions().length, 1);
    uninstallFakeBrowser();
    installFakeBrowser();
    loadGoogleTag();
    assert.equal(conversions().length, 0);
  });

  it("drops rejected and invalid requests", () => {
    const { storage } = installFakeBrowser();
    storage.clear();
    queueBookingConversion("WG-123");
    clearPendingBookingConversions();
    storage.set("wg-consent", "rejected");
    queueBookingConversion("WG-124");
    storage.set("wg-consent", "accepted");
    loadGoogleTag();
    queueBookingConversion("arbitrary-url");
    assert.equal(conversions().length, 0);
  });

  it("does not send with missing consent, missing label or disabled Ads", () => {
    const { storage } = installFakeBrowser();
    loadGoogleTag();
    assert.equal(trackGoogleAdsConversion({ label: "" }), false);
    assert.equal(trackGoogleAdsConversion({ adsId: null }), false);
    storage.set("wg-consent", "rejected");
    assert.equal(trackGoogleAdsConversion(), false);
    assert.equal(conversions().length, 0);
  });

  it("isolates tag errors from the successful booking", () => {
    const { fakeWindow } = installFakeBrowser();
    loadGoogleTag();
    fakeWindow.gtag = () => {
      throw new Error("blocked");
    };
    assert.doesNotThrow(() => queueBookingConversion("WG-123"));
  });
});
