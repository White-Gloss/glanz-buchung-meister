import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { cities, site } from "@/data/site";
import { cityJsonLd, serviceCityHeading, serviceCityTitle } from "./city-seo.ts";

describe("city landing SEO", () => {
  const horb = cities.find((city) => city.slug === "horb-am-neckar");
  const nagold = cities.find((city) => city.slug === "nagold");

  it("keeps the Horb service-city title distinct from the homepage", () => {
    assert.ok(horb);
    assert.equal(
      serviceCityTitle("Fahrzeugaufbereitung", horb),
      "Fahrzeugaufbereitung mit Abholung in Horb | White Gloss",
    );
    assert.equal(
      serviceCityTitle("Innenraumreinigung", nagold!),
      "Innenraumreinigung Nagold | White Gloss",
    );
    assert.equal(
      serviceCityHeading("Fahrzeugaufbereitung", horb),
      "Fahrzeugaufbereitung mit Abholung in Horb am Neckar",
    );
    assert.equal(serviceCityHeading("Innenraumreinigung", nagold!), "Innenraumreinigung in Nagold");
  });

  it("describes the city page as a service from the real Horb business", () => {
    assert.ok(nagold);
    const schema = cityJsonLd(nagold);
    const service = schema["@graph"][0];

    assert.equal(service["@type"], "Service");
    assert.equal(service["@id"], `${site.origin}/abholservice/nagold#service`);
    assert.equal(service.provider["@id"], `${site.origin}/#betrieb`);
    assert.equal(service.provider.address.addressLocality, site.city);
    assert.deepEqual(service.areaServed, { "@type": "City", name: "Nagold" });
  });
});
