import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/dellen")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
