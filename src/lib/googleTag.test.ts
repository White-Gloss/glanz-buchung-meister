import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_GOOGLE_ADS_ID,
  resolveGoogleAdsId,
  trackGoogleAdsConversion,
} from "./googleTag.ts";

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
