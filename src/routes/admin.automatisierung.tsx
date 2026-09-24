import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/automatisierung")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
