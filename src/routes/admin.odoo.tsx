import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/odoo")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
