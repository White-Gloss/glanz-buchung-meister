import type { RouterManagedTag } from "@tanstack/router-core";

/** Hydration starts at the latest this long after the bootstrap ran. */
export const DEFERRED_BOOTSTRAP_FALLBACK_MS = 3000;

function serialize(value: readonly string[]) {
  // The lists are embedded in an inline script: never allow a closing tag.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Inline script that starts the client bundle after the first viewport has
 * painted. It waits for the document to be parsed and for every eager
 * `fetchpriority="high"` image to load and decode, lets two frames pass so
 * those images are on screen, then inserts the module preloads and entries
 * exactly as Start would have rendered them. A timer guarantees hydration
 * when frames are paused, e.g. in a background tab.
 */
export function deferredBootstrapSource(entries: readonly string[], preloads: readonly string[]) {
  return (
    "(function(d,w,e,p){var s=0;" +
    "function g(){if(s)return;s=1;" +
    'p.forEach(function(h){var l=d.createElement("link");l.rel="modulepreload";l.href=h;d.head.appendChild(l)});' +
    'e.forEach(function(h){var t=d.createElement("script");t.type="module";t.setAttribute("async","");t.src=h;d.head.appendChild(t)})}' +
    "function f(){w.requestAnimationFrame(function(){w.requestAnimationFrame(g)})}" +
    "function r(){var a=[];" +
    'd.querySelectorAll(\'img[fetchpriority="high"]:not([loading="lazy"])\').forEach(function(i){' +
    "a.push(new Promise(function(o){if(i.complete)o();else{" +
    'i.addEventListener("load",o,{once:true});i.addEventListener("error",o,{once:true})}})' +
    ".then(function(){return i.decode&&i.decode()}).catch(function(){}))});" +
    "Promise.all(a).then(f)}" +
    `w.setTimeout(g,${DEFERRED_BOOTSTRAP_FALLBACK_MS});` +
    'd.readyState==="loading"?d.addEventListener("DOMContentLoaded",r,{once:true}):r()' +
    `})(document,window,${serialize(entries)},${serialize(preloads)})`
  );
}

export function isModuleEntry(tag: RouterManagedTag) {
  return (
    tag.tag === "script" &&
    tag.attrs?.type === "module" &&
    typeof tag.attrs?.src === "string" &&
    !tag.children
  );
}

export function isModulePreload(tag: RouterManagedTag) {
  return (
    tag.tag === "link" &&
    typeof tag.attrs?.rel === "string" &&
    tag.attrs.rel.split(/\s+/).includes("modulepreload") &&
    typeof tag.attrs?.href === "string"
  );
}
