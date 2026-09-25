import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/zoho")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
