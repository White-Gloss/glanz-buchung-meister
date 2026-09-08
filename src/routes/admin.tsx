import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpenText,
  CalendarDays,
  ClipboardList,
  Database,
  Inbox,
  Settings,
  Users,
  Workflow,
} from "lucide-react";
import { BrandMark } from "@/components/media";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getOperatorAccess } from "@/lib/admin.functions";
import { adminNav } from "@/lib/admin-nav";
import { site } from "@/data/site";

const icons: Record<string, typeof CalendarDays> = {
  Buchungen: ClipboardList,
  Posteingang: Inbox,
  Kalender: CalendarDays,
  Leitstand: Workflow,
  Kundenakten: Users,
  Dokumente: BookOpenText,
  "Odoo & Qonto": Database,
  Einstellungen: Settings,
};

export const Route = createFileRoute("/admin")({
  component: AdminShell,
  head: () => ({
    meta: [{ title: `Betrieb | ${site.name}` }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function AdminShell() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [access, setAccess] = useState<"pending" | "ok" | "denied">("pending");

  useEffect(() => {
    if (!user) {
      setAccess("pending");
      return;
    }
    let cancelled = false;
    getOperatorAccess()
      .then((result) => {
        if (!cancelled) setAccess(result.ok ? "ok" : "denied");
      })
      .catch(() => {
        if (!cancelled) setAccess("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isPending || (user && access === "pending")) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-sm text-muted">Sitzung wird geprüft …</p>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (access === "denied") {
    return (
      <main id="main-content" className="grid min-h-dvh place-items-center px-4" tabIndex={-1}>
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl">Kein Betriebszugang</h1>
          <p className="text-sm text-muted">
            Dieses Konto ist nicht für das Betriebspanel freigeschaltet. Öffentliche Registrierung
            ist nicht vorgesehen.
          </p>
          <div className="flex justify-center">
            <UserButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <div id="main-content" className="min-h-dvh bg-bg" tabIndex={-1}>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-h-11 items-center gap-3">
            <BrandMark variant="header" decorative />
            <p className="text-xs uppercase tracking-[0.16em] text-subtle">Betrieb</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link to="/" className="text-sm text-muted hover:text-fg">
              Website
            </Link>
            <div className="border-l border-line pl-4">
              <UserButton />
            </div>
          </div>
        </div>
      </header>
      <nav
        aria-label="Admin-Hauptnavigation"
        className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {adminNav.map((item) => {
            const Icon = icons[item.label] ?? ClipboardList;
            const active =
              item.match === "exact"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-sm px-3 text-sm",
                  active
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-elevated hover:text-fg",
                ].join(" ")}
              >
                <Icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
