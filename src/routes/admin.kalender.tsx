import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/kalender")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
