/**
 * Above-the-fold CSS inlined in `__root` as ATF insurance while the blocking
 * stylesheet parses (dark body, hero/header/stats boxes). Full `styles.css`
 * is render-blocking again — deferred print→all caused ~0.50 CLS when this
 * mismatched final utilities on `.hero-follow` (post-#214). Harmless once
 * full CSS applies; prefer stable layout over micro render-blocking savings.
 */
export const CRITICAL_CSS = `html{color-scheme:dark;background:#000;-webkit-font-smoothing:antialiased;touch-action:manipulation;scroll-padding-top:5.75rem}
body{margin:0;background:#000;color:#fff;font-family:Barlow,"Barlow Fallback",Arial,"Helvetica Neue",Helvetica,ui-sans-serif,system-ui,sans-serif;line-height:1.55}
@font-face{font-family:Barlow;font-style:normal;font-weight:300;font-display:optional;src:url("/fonts/barlow-300.woff2") format("woff2")}
@font-face{font-family:Barlow;font-style:normal;font-weight:400;font-display:optional;src:url("/fonts/barlow-400.woff2") format("woff2")}
@font-face{font-family:"Barlow Fallback";src:local("Arial"),local("Helvetica Neue"),local("Helvetica");size-adjust:101%;ascent-override:94%;descent-override:25%;line-gap-override:0%}
.site-header{position:fixed;inset-inline:0;top:0;z-index:40}
.gd-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:1rem;width:100%;min-height:4.5rem}
.hero-stage{position:relative;overflow:hidden;display:flex;flex-direction:column;min-height:100svh}
.hero-intro{min-height:auto}
.hero-intro .hero-stage-copy{min-height:min(42rem,85svh);opacity:1;transform:none;animation:none}
main>.hero-intro+.hero-follow{margin-top:0;opacity:1;transform:none;animation:none}
.hero-stage-media{position:absolute;inset:0;width:100%;height:100%;transform:none;filter:none}
.hero-stage-media>.hero-image,.hero-stage-media img,.hero-stage-media video,.hero-stage-media picture{position:absolute;inset:0;display:block;width:100%;height:100%;max-width:none;max-height:none;object-fit:cover}
.hero-stage-veil{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to bottom,rgb(0 0 0/.5),rgb(0 0 0/.14) 38%,rgb(0 0 0/.42) 68%,#000)}
.hero-intro .hero-stage-veil{background:linear-gradient(#0009,#0008 55%,#000)}
.hero-stage-copy{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:7rem 1rem 5rem;opacity:1;transform:none}
.hero-title{margin:1.25rem 0 0;font-weight:300;letter-spacing:-.025em;font-size:clamp(2rem,5vw,4rem);line-height:1.08;max-width:56rem}
.hero-follow{min-height:13.5rem;border-bottom:1px solid rgb(255 255 255/.08);opacity:1;transform:none}
.gd-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.gd-stats>li{padding:1.75rem 1rem;border-bottom:1px solid rgb(255 255 255/.08);border-right:1px solid rgb(255 255 255/.08);box-sizing:border-box}
@media (min-width:640px){.gd-stats{grid-template-columns:repeat(4,minmax(0,1fr))}.hero-follow{min-height:7.5rem}.gd-stats>li{padding:2rem 1.5rem}}
img,video{max-width:100%;height:auto}
.hero-stage-media img,.hero-stage-media video{max-width:none;height:100%}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
[data-wa-float]{position:fixed;right:1rem;bottom:max(1rem,env(safe-area-inset-bottom));z-index:40;display:inline-flex;width:3rem;height:3rem;align-items:center;justify-content:center;border-radius:999px;background:#25d366;color:#0a0a0a;box-shadow:0 10px 15px -3px rgb(0 0 0/.3)}
@media (min-width:640px){[data-wa-float]{right:1.5rem;width:3.5rem;height:3.5rem}}`;
