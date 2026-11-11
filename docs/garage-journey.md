# Automotive imagery and scroll follow-up

Visual-only follow-up. Existing visible copy, prices, customer results, real workshop photography, booking flow and CMS overrides are preserved.

## Current implementation

- Two generated decorative automotive images after HomeProcess: polished black classic and modern black grand tourer. They are atmospheric brand visuals, never evidence of customer work.
- Desktop stage stays pinned while the second image moves upward over the first; reverse scrolling reverses it. Mobile, short screens and reduced motion remain static.
- Native requestAnimationFrame is intersection-gated; no extra animation dependency. A main-height observer accounts for lazy sections changing the chapter position.
- Hero scroll range extended from 240/180 svh to 420/320 svh. Existing pause, skip, low-memory/data-saver and reduced-motion policies stay intact.
- The CURRENTLY PUBLISHED studio-journey movie remains the hero source. The first newly generated quiet garage movie is NOT selected.

## Action film revision — blocked, not substituted

The owner requested more action: actual forward driving through mud with visible splashes, entry into the garage, high-gloss reveal and physical rotation of the car. Three new matching keyframes have been generated and visually reviewed. Both video submissions failed before job creation due to insufficient Higgsfield credits. Exact prompts, generation parameters and reference IDs are in garage-action-plan.json. Replace the movie only after that version exists and passes visual review.

The earlier quiet movie (not active) is generation ad8e67de-cff6-4cc8-811c-c958c19b0e84. It must not be mistaken for the requested action revision.

## Image sources and delivery

Higgsfield image jobs: classic 6316bfcc-4f23-42af-8bce-af3eaa7d0366 and grand tourer b058d4fa-329b-43c0-b810-bcf141fa5903 (2026-11-11). The classic references the existing owner-approved classic coupe poster.

scripts/automotive-media.json pins the exact bytes and SHA-256 of six responsive WebP files. The build downloads and verifies them into public/media/automotive-journey; Vite includes them in the existing Hostinger release. Visitors only request these media from the website's own origin. Missing or changed upstream files fail the build; verified files can be reused offline.

## Verification

Existing isolated Linux CI gates remain required. New checks exercise forward/reverse image movement, decoding, same-origin delivery, static mobile and reduced-motion fallbacks. Loader checks reject bad hashes, failed downloads and invalid manifest paths. Existing decoded film seeking and the no-content-change guard stay enabled. No local website server is used.
