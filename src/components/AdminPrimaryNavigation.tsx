import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpenText, CalendarDays, Settings, Users } from "lucide-react";
import { adminNavigationGroups } from "@/lib/adminNavigation";

const icons: Record<string, typeof CalendarDays> = {
  Buchungen: CalendarDays,
  Kundenakten: Users,
  Dokumente: BookOpenText,
  Einstellungen: Settings,
};

export function AdminPrimaryNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = adminNavigationGroups.flatMap((group) => group.items);

  return (
    <nav
      aria-label="Admin-Hauptnavigation"
      className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 sm:px-6">
        {items.map((item) => {
          const Icon = icons[item.label] ?? CalendarDays;
          const active =
            item.to === "/admin"
              ? pathname === "/admin" || pathname === "/admin/"
              : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={[
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              ].join(" ")}
            >
              <Icon aria-hidden className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
