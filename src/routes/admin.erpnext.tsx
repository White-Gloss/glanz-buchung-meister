import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/erpnext")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/odoo", replace: true });
  },
});
