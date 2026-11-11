# Garage arrival and automotive imagery

Visual-only follow-up to the Forge-inspired public website. Existing copy, prices, customer results, real workshop photography, booking flow, and CMS overrides are preserved. The poster alt text describes its new scene.

## Approved direction

The owner requested additional AI automotive imagery, a longer scroll-following scene, and specifically a dirty classic entering a detailing garage followed by a close glossy reveal. These are staged brand visuals, not customer before/after evidence.

## Generated sources (2026-11-11)

- Higgsfield image jobs: dirty entrance `0d5b7cc5-f2de-47fc-a7b9-c5db5a9c410b`; glossy classic `6316bfcc-4f23-42af-8bce-af3eaa7d0366`; modern grand tourer `b058d4fa-329b-43c0-b810-bcf141fa5903`.
- First/last classic keyframes reference the existing owner-approved classic coupe poster. Both preserve the same body, chrome and wire wheels.
- MiniMax H3 video job `ad8e67de-cff6-4cc8-811c-c958c19b0e84`, 2560 x 1440, 24 fps, approximately 10 seconds. Dirty arrival, dark close-up transition, polished final view.
- Original film: https://d8j0ntlcm91z4.cloudfront.net/user_3IiKHVlDwrF1Y5QooEGFMg6XriC/hf_20261111_045201_ad8e67de-cff6-4cc8-811c-c958c19b0e84.mp4
- A contact sheet at one-second intervals was visually inspected before integration. No generated photo is used as a customer result or as the actual workshop photograph.

## Delivery

`scripts/automotive-media.json` pins the exact bytes and SHA-256 of twelve media files. The build downloads and verifies them into public media folders; Vite includes them in the existing Hostinger release. Visitors only request media from the website's own origin. A missing or changed upstream file fails the build; already verified files can be reused offline. Do not publish a build with integrity checks disabled.

Web film exports are silent H.264, yuv420p, faststart, 24 fps, no B frames, keyframes every six frames. Desktop 1280 x 720 (4,198,979 bytes); mobile 540 x 960 (2,190,217 bytes). The portrait crop focuses on the rear quarter/chrome rather than shrinking the entire landscape scene. Posters are responsive WebP. Original downloadable master retains its generated audio; the website variants contain no audio track.

## Motion

- Hero scroll range: 420 svh desktop and 320 svh mobile, compared with 240/180 before. Native scroll, skip link, pause, reduced-motion, low-memory/data-saver and short-screen policies remain.
- Additional image chapter after HomeProcess: two full-width decorative images. Desktop stage stays pinned while the second image moves upward over the first; reverse scrolling reverses it. Below 960 px and for reduced motion, images are static and directly accessible.
- The new chapter uses an intersection-gated native animation frame and CSS transforms. It adds no animation dependency or continuous offscreen loop.

## Verification

Existing isolated Linux CI must remain green before release. The hero suite now exercises the new image chapter forward/reverse, image decoding, same-origin delivery, static mobile layout and reduced-motion fallback. Media loader tests cover checksum rejection, cached reuse, unavailable sources and invalid manifest entries. Existing decoded film seeking and no-content-change checks remain enabled.

No local website server was started. A disconnected operator computer prevents final live-browser inspection and manual Hostinger workflow dispatch until reconnected.
