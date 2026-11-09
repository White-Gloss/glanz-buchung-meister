import { getPublishedCmsDocument } from "./cms.functions";
import type { CmsDocumentKey } from "./cms.model";
import type { PublishedStudioDocument } from "./studio-public";

/** The server logs CMS failures. Existing public pages retain their static content
 * when editorial storage is unavailable; drafts never cross this read boundary. */
export async function loadPublicStudioDocument(
  key: CmsDocumentKey,
): Promise<PublishedStudioDocument | null> {
  try {
    return await getPublishedCmsDocument({ data: { key } });
  } catch {
    return null;
  }
}
