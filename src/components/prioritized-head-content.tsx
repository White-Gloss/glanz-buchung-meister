"use client";

import { Asset, useRouter, useTags } from "@tanstack/react-router";
import type { AssetCrossOriginConfig } from "@tanstack/router-core";
import { isServer } from "@tanstack/router-core/isServer";
import { isModulePreload } from "@/lib/deferred-bootstrap";

export interface PrioritizedHeadContentProps {
  assetCrossOrigin?: AssetCrossOriginConfig;
}

/**
 * Render all Start-managed head assets with their existing keys and CSP nonce.
 * The server leaves module preloads to the deferred bootstrap, which inserts
 * them together with the entry after the first viewport has painted. On the
 * client they stay low-priority hints for navigation.
 */
export function PrioritizedHeadContent(props: PrioritizedHeadContentProps) {
  const tags = useTags(props.assetCrossOrigin);
  const router = useRouter();
  const nonce = router.options.ssr?.nonce;
  const server = isServer ?? router.isServer;

  return (
    <>
      {tags.map((tag) => {
        const modulePreload = isModulePreload(tag);
        if (modulePreload && server) return null;

        return (
          <Asset
            {...tag}
            attrs={modulePreload ? { ...tag.attrs, fetchPriority: "low" } : tag.attrs}
            key={`tsr-meta-${JSON.stringify(tag)}`}
            nonce={nonce}
          />
        );
      })}
    </>
  );
}
