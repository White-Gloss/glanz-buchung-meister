import { createFileRoute } from "@tanstack/react-router";
import { ChannelInbox } from "@/components/channel-inbox";

export const Route = createFileRoute("/admin/dellen")({
  component: () => (
    <ChannelInbox
      channel="dellen"
      heading="Dellen & Hagelschäden"
      kicker="Kommunikation"
      hint="Begutachtungsanfragen mit Schadensfotos. Kein Preis ohne Prüfung – wie auf der öffentlichen Seite."
    />
  ),
});
