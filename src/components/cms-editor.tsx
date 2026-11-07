import type { CmsKind } from "@/lib/cms.functions";
import { WebsiteStudio } from "./website-studio";

/** Existing admin URLs use the same draft/version workflow as Website Studio. */
export function CmsEditor({
  kind,
}: {
  kind: CmsKind;
  heading: string;
  kicker: string;
  hint: string;
  slugField?: boolean;
  extraLabel?: string;
}) {
  return <WebsiteStudio initialKind={kind} />;
}
