import { createFileRoute, Outlet } from "@tanstack/react-router";
import "@/styles/ratgeber.css";

export const Route = createFileRoute("/ratgeber")({
  component: Outlet,
});
