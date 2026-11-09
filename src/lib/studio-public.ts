import { customerPhotos, type CustomerPhoto } from "../data/customer-photos.ts";
import type { CmsDocumentContent } from "./cms.model.ts";
import type { StudioAsset } from "./studio-media.model.ts";

export type PublishedStudioDocument = {
  content: CmsDocumentContent;
  revisionId: number | null;
  assets: StudioAsset[];
};
export type GalleryPhoto = Omit<CustomerPhoto, "category" | "srcSet"> & {
  category: string;
  srcSet?: string;
};

export function studioMetadata(
  document: PublishedStudioDocument | null | undefined,
  fallback: { title: string; description: string },
) {
  return {
    title: document?.content.metaTitle.trim() || fallback.title,
    description: document?.content.metaDescription.trim() || fallback.description,
  };
}

export function studioHero(
  document: PublishedStudioDocument | null | undefined,
): StudioAsset | undefined {
  const asset = document?.assets.find((item) => item.id === document.content.heroAssetId);
  if (!asset) return undefined;
  const reference = document?.content.images.find((item) => item.assetId === asset.id);
  return {
    ...asset,
    alt: reference?.alt ?? asset.alt,
    caption: reference?.caption ?? asset.caption,
  };
}

export function studioGalleryPhotos(
  document: PublishedStudioDocument | null | undefined,
): GalleryPhoto[] | undefined {
  if (!document) return undefined;
  return document.content.images.flatMap((reference) => {
    const asset = document.assets.find((item) => item.id === reference.assetId);
    if (!asset) return [];
    const original = customerPhotos.find((photo) => asset.id === `static:${photo.id}`);
    return [
      {
        id: asset.id,
        title: reference.caption.trim() || reference.alt.trim(),
        alt: reference.alt,
        width: asset.width,
        height: asset.height,
        src: asset.src,
        srcSet: original?.srcSet,
        category: original?.category ?? "Galerie",
        position: original?.position ?? "50% 50%",
      },
    ];
  });
}
