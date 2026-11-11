import { createFileRoute, Outlet } from "@tanstack/react-router";
import ratgeberCss from "@/styles/ratgeber.css?url";

export const Route = createFileRoute("/ratgeber")({
  head: () => ({
    links: [{ rel: "stylesheet", href: ratgeberCss }],
  }),
  component: Outlet,
});
