import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/posteingang")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
