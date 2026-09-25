import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/unterlagen")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
