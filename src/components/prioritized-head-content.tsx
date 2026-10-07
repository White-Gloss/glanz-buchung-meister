"use client";

import { Asset, useRouter, useTags } from "@tanstack/react-router";
import type { AssetCrossOriginConfig } from "@tanstack/router-core";

export interface PrioritizedHeadContentProps {
  assetCrossOrigin?: AssetCrossOriginConfig;
}

/**
 * Render all Start-managed head assets with their existing keys and CSP nonce.
 * Only modulepreload links receive a lower network fetch priority.
 */
export function PrioritizedHeadContent(props: PrioritizedHeadContentProps) {
  const tags = useTags(props.assetCrossOrigin);
  const router = useRouter();
  const nonce = router.options.ssr?.nonce;

  return (
    <>
      {tags.map((tag) => {
        const modulePreload =
          tag.tag === "link" &&
          typeof tag.attrs?.rel === "string" &&
          tag.attrs.rel.split(/\s+/).includes("modulepreload");

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
