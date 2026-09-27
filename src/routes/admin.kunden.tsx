import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/kunden")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
