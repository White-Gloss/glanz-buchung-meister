"use client";

import { Asset, Scripts, useRouter, useTags } from "@tanstack/react-router";
import { _getAssetMatches, type RouterManagedTag } from "@tanstack/router-core";
import { isServer } from "@tanstack/router-core/isServer";
import { deferredBootstrapSource, isModuleEntry, isModulePreload } from "@/lib/deferred-bootstrap";

type ScriptAsset = RouterManagedTag & { preventScriptHoist?: boolean };

/**
 * Server-side counterpart of Start's `<Scripts />`: renders every body script
 * unchanged except the module entry, which moves into the deferred bootstrap
 * together with the module preloads the head would have rendered. The
 * server-rendered document is complete without JavaScript, so hydration no
 * longer competes with the hero image and fonts for the first bytes.
 */
function ServerDeferredScripts() {
  const router = useRouter();
  const nonce = router.options.ssr?.nonce;
  const preloads = useTags()
    .filter(isModulePreload)
    .map((tag) => String(tag.attrs?.href));

  const matches = _getAssetMatches(router.stores.matches.get());
  const scripts: ScriptAsset[] = matches
    .flatMap((match) => match.scripts ?? [])
    .filter((script) => script !== undefined)
    .map(({ children, ...script }) => ({
      tag: "script",
      attrs: { ...script, suppressHydrationWarning: true, nonce },
      children: typeof children === "string" ? children : undefined,
    }));
  const entries: string[] = [];
  const manifest = router.ssr?.manifest;
  for (const match of matches) {
    for (const asset of manifest?.routes[match.routeId]?.scripts ?? []) {
      const tag: ScriptAsset = {
        tag: "script",
        attrs: { ...asset.attrs, nonce },
        children: asset.children,
        // As in Start: keep server-rendered src scripts in place.
        ...(typeof asset.attrs?.src === "string" ? { preventScriptHoist: true } : {}),
      };
      if (isModuleEntry(tag)) entries.push(String(tag.attrs?.src));
      else scripts.push(tag);
    }
  }
  if (entries.length) {
    scripts.push({
      tag: "script",
      attrs: { nonce },
      children: deferredBootstrapSource(entries, [...new Set(preloads)]),
    });
  }
  const buffered = router.serverSsr?.takeBufferedScripts();
  if (buffered) scripts.unshift(buffered);

  return (
    <>
      {scripts.map((asset, index) => (
        <Asset {...asset} key={`tsr-scripts-${asset.tag}-${index}`} />
      ))}
    </>
  );
}

/**
 * The client keeps Start's own component. React skips the server-only
 * bootstrap during hydration like the streamed router scripts, and Start
 * finds the entry the bootstrap inserted instead of adding a second one.
 */
export function DeferredScripts() {
  const router = useRouter();
  return (isServer ?? router.isServer) ? <ServerDeferredScripts /> : <Scripts />;
}
