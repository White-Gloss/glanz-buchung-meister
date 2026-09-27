import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/zustand")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bitrix" });
  },
});
