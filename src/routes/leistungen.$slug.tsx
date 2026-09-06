import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/leistungen/$slug")({
  component: Outlet,
});
