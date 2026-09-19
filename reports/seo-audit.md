# SEO audit: white-gloss.de

Audit run: 19 September 2026 (production crawl began 05:58 UTC)  
Source audited: `https://white-gloss.de/sitemap.xml`

## Scope and result

- Crawled all **183/183 sitemap URLs** with concurrency limited to three requests and a short delay between requests.
- Scope included **13 pickup-city pages**, **130 service/city pages**, **10 core service pages**, **13 guide detail pages**, and the remaining public landing/legal pages.
- All 183 pages returned HTTP 200 HTML.
- SSR response checks found exactly one title, one meta description, one H1, one indexable robots directive, and one self-referencing HTTPS canonical on every page.
- Titles had one duplicate group (two URLs); descriptions had no duplicate groups; H1s had one duplicate group (two URLs).
- Parsed **160 JSON-LD blocks on 160 pages**; all were valid JSON. This is a syntax check, not a Google Rich Results eligibility test.
- Checked **324 unique internal link targets** found in rendered HTML: no HTTP errors or redirects.
- Checked **66 unique referenced, non-inline image URLs**: no HTTP errors.
- `robots.txt` returned plain text with the production sitemap declaration and did not block public landing pages. `sitemap.xml` returned XML, had 183 unique static canonical URLs, and included the city/service matrix.

The crawl confirms that public landing-page content and metadata are present in the server response. Google can render JavaScript, but SSR makes these essential signals available without depending on client rendering.

## Corrections implemented

1. **Duplicate Horb intent**
   - Production used `Fahrzeugaufbereitung Horb am Neckar | White Gloss` for both the homepage and the Horb service/city page.
   - The core service page and Horb service/city page also shared the H1 `Fahrzeugaufbereitung in Horb am Neckar`.
   - The Horb service/city route now identifies its distinct pickup intent in its title and H1. Other already-unique city pages remain unchanged.

2. **Pickup-city entity modeling**
   - Each of the 13 pickup pages declared a separate city-branded `AutomotiveBusiness` ID while giving it the same physical Horb address. This could imply multiple business locations.
   - These pages now describe the actual pickup offering as a `Service`, set the selected city as `areaServed`, and reference the single real Horb business entity as provider. Existing breadcrumbs, URLs, contact details, prices, and business facts were preserved.

3. **Service/city schema identity**
   - The 130 service/city schemas now include stable page-level service IDs and URLs, reference the canonical business entity, and express `areaServed` as a `City` rather than an untyped string.

Regression coverage was added for the duplicate Horb metadata and single-location/provider schema contract.

## Open, evidence-based limitations

- **23 sitemap pages have no JSON-LD block**, including the 10 core service pages, `/preise`, `/leistungen`, and several general/legal pages. Schema is not required for crawling or indexing, and the audit found no malformed markup on pages that do emit it. Core service schema is the most relevant future addition; legal-page schema is low priority.
- Several guide titles exceed common display-length heuristics (up to 82 characters). They are unique and descriptive; no editorial titles were rewritten without search-query or click-through evidence.
- Static HTTP checks do not establish rich-result eligibility. Validate deployed schema with Schema.org Validator and Google Rich Results Test after release.
- This audit had no Google Search Console, analytics, backlink, or live SERP data. It cannot establish index coverage, queries, conversions, authority, or rankings.
- Core Web Vitals require field data (CrUX/Search Console) or a dedicated lab run. They were not measured here, and no CWV claim is made.
- The crawl describes production before these source changes are deployed. Re-run the same checks after release.
