import { createFileRoute } from "@tanstack/react-router";
import { ChannelInbox } from "@/components/channel-inbox";

export const Route = createFileRoute("/admin/zustand")({
  component: () => (
    <ChannelInbox
      channel="zustand"
      heading="Zustandsmeldungen"
      kicker="Kommunikation"
      hint="Fotos und Beschreibungen aus dem Formular Fahrzeugzustand. Antworten landen im Posteingang als Ausgang."
    />
  ),
});
