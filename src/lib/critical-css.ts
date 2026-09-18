/**
 * Above-the-fold CSS inlined in `__root` so the full Tailwind stylesheet can
 * load non-blocking (media=print → all) without a white FOUC or hero CLS.
 * Keep this tiny — utilities and film chrome stay in `styles.css`.
 */
export const CRITICAL_CSS = `html{color-scheme:dark;background:#000;-webkit-font-smoothing:antialiased;touch-action:manipulation;scroll-padding-top:5.75rem}
body{margin:0;background:#000;color:#fff;font-family:Barlow,"Barlow Fallback",Arial,"Helvetica Neue",Helvetica,ui-sans-serif,system-ui,sans-serif;line-height:1.55}
@font-face{font-family:Barlow;font-style:normal;font-weight:300;font-display:optional;src:url("/fonts/barlow-300.woff2") format("woff2")}
@font-face{font-family:Barlow;font-style:normal;font-weight:400;font-display:optional;src:url("/fonts/barlow-400.woff2") format("woff2")}
@font-face{font-family:"Barlow Fallback";src:local("Arial"),local("Helvetica Neue"),local("Helvetica");size-adjust:101%;ascent-override:94%;descent-override:25%;line-gap-override:0%}
.site-header{position:fixed;inset-inline:0;top:0;z-index:40}
.gd-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:1rem;width:100%;min-height:4.5rem}
.hero-stage{position:relative;min-height:100svh;overflow:hidden;display:flex;flex-direction:column}
.hero-stage-media{position:absolute;inset:0}
.hero-stage-media img,.hero-stage-media video,.hero-stage-media picture{width:100%;height:100%;object-fit:cover}
.hero-stage-veil{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to bottom,rgb(0 0 0/.5),rgb(0 0 0/.14) 38%,rgb(0 0 0/.42) 68%,#000)}
.hero-stage-copy{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:7rem 1rem 5rem}
.hero-title{margin:1.25rem 0 0;font-weight:300;letter-spacing:-.02em;font-size:clamp(2rem,6vw,3.75rem);line-height:1.1;max-width:56rem}
.hero-follow{min-height:5.5rem;border-bottom:1px solid rgb(255 255 255/.08)}
.gd-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:640px){.gd-stats{grid-template-columns:repeat(4,minmax(0,1fr))}}
img,video{max-width:100%;height:auto}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}`;
