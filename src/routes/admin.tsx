import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleDollarSign,
  Download,
  Search,
  Trash2,
  CalendarClock,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadBookings,
  saveBookings,
  currency,
  type Booking,
  type BookingStatus,
} from "@/lib/bookings";
import { generateInvoicePdf } from "@/lib/invoice";
import { servicePackages, vehicleTypes } from "@/lib/servicesConfig";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard – White Gloss Detailing" },
      {
        name: "description",
        content:
          "Interne Übersicht aller Buchungen, Kundendaten, Zahlungsstatus und Rechnungsdownloads.",
      },
      { property: "og:title", content: "Admin Dashboard – White Gloss Detailing" },
      {
        property: "og:description",
        content: "Buchungen verwalten, Status pflegen und Rechnungen erneut herunterladen.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const statusStyles: Record<BookingStatus, string> = {
  Ausstehend: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Bezahlt: "bg-primary/15 text-primary border-primary/40",
  Storniert: "bg-destructive/15 text-destructive border-destructive/40",
};

function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setBookings(loadBookings());
  }, []);

  function update(next: Booking[]) {
    setBookings(next);
    saveBookings(next);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) =>
      [b.invoiceNumber, b.customer.name, b.customer.plate, b.customer.email]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [bookings, query]);

  const revenue = bookings
    .filter((b) => b.status !== "Storniert")
    .reduce((s, b) => s + b.total, 0);
  const open = bookings.filter((b) => b.status === "Ausstehend").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold sm:text-2xl">Admin Dashboard</h1>
            <p className="truncate text-sm text-muted-foreground">
              Buchungen, Status und Rechnungen
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Zur Website
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={Receipt} label="Buchungen gesamt" value={String(bookings.length)} />
          <Stat icon={CalendarClock} label="Offene Termine" value={String(open)} />
          <Stat icon={CircleDollarSign} label="Umsatz (brutto)" value={currency(revenue)} />
        </div>

        <div className="mt-8 flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              maxLength={80}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche nach Name, Kennzeichen, Rechnung …"
              className="h-11 bg-secondary/40 pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="glass mt-6 rounded-3xl p-12 text-center">
            <p className="font-display text-lg">Keine Buchungen vorhanden</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Neue Buchungen erscheinen hier automatisch, sobald sie über die Website eingehen.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filtered.map((b) => {
              const vehicle = vehicleTypes.find((v) => v.id === b.vehicleId);
              const pkg = servicePackages.find((p) => p.id === b.packageId);
              return (
                <article key={b.id} className="glass rounded-2xl p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-semibold">{b.customer.name}</span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs ${statusStyles[b.status]}`}
                        >
                          {b.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{b.invoiceNumber}</span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {b.customer.email} · {b.customer.phone} · {b.customer.plate}
                      </p>
                      <p className="text-sm text-foreground/80">
                        {pkg?.name} · {vehicle?.name} ·{" "}
                        {new Date(b.date).toLocaleDateString("de-DE", { dateStyle: "long" })},{" "}
                        {b.time} Uhr
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <span className="font-display text-xl font-bold text-primary tabular-nums">
                        {currency(b.total)}
                      </span>
                      <select
                        aria-label="Status ändern"
                        value={b.status}
                        onChange={(e) =>
                          update(
                            bookings.map((x) =>
                              x.id === b.id
                                ? { ...x, status: e.target.value as BookingStatus }
                                : x,
                            ),
                          )
                        }
                        className="h-9 rounded-lg border border-border bg-secondary/50 px-2 text-sm"
                      >
                        <option>Ausstehend</option>
                        <option>Bezahlt</option>
                        <option>Storniert</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={() => generateInvoicePdf(b)}>
                        <Download className="size-4" />
                        Rechnung
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Buchung löschen"
                        onClick={() => {
                          update(bookings.filter((x) => x.id !== b.id));
                          toast.success("Buchung gelöscht");
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
