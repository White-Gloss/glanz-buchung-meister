# Automotive action film and scroll chapter

Visual-only change. Visible copy, prices, real workshop and customer evidence, booking rules and CMS overrides remain unchanged.

## Hero

18-second silent film: forward muddy driving and tyre splashes, garage entry, bodywork wipe into mirror-gloss finish, then continuous turntable rotation through the side into a front three-quarter view. The initial generated rotation was rejected for a jump cut. The corrected shot and the concatenation boundary were visually reviewed before integration.

Native scroll scrubs the film forward and backward over the extended 420/320 svh desktop/mobile range. Existing pause, skip, reduced-motion, short-screen, low-memory and data-saver policies remain. The film downloads only after engagement. Mobile uses a separate 540x960 crop that follows the car's front during rotation. Its first poster matches that crop.

Sources, prompts, review and encoding details: garage-action-plan.json. The film remains staged AI brand imagery, never proof of customer work or the actual premises.

## Image chapter

Two decorative car images follow HomeProcess. Desktop pins the stage while the next image moves upward; reverse scrolling restores the first. Mobile, short displays and reduced motion show static images. Animation is native RAF and intersection-gated.

## Delivery and verification

Twelve responsive media assets have exact byte counts and SHA-256 in scripts/automotive-media.json. The build fetches and verifies them; visitors request same-origin assets. Verified local inputs are reusable; missing or changed upstream files fail closed.

Required isolated Linux CI checks cover film decoding while scrubbing forward/reverse, image movement, mobile/reduced-motion fallbacks, unchanged visible copy and booking behavior. No local website server is started. Consent banner height writes are deferred outside ResizeObserver delivery to address the WebKit loop diagnostic.

Candidate publication remains pending fresh CI. Prior failures were a WebKit ResizeObserver diagnostic and a responsive booking test timing out while returning to page top; the latter now records exact geometry on failure.
