import { createFileRoute } from "@tanstack/react-router";
import { WebsiteStudio } from "@/components/website-studio";

export const Route = createFileRoute("/admin/studio")({
  component: WebsiteStudio,
  head: () => ({
    meta: [
      { title: "Website Studio | White-Gloss" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});
