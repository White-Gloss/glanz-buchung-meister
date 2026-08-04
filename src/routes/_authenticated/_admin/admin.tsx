import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
