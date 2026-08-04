import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CalendarFeedCard } from "@/components/CalendarFeedCard";
import {
  ArrowLeft,
  CircleDollarSign,
  Download,
  Search,
  Trash2,
  CalendarClock,
  Receipt,
  CheckCircle2,
  LogOut,
  Wallet,
  ShieldAlert,
  Sparkles,
  Users,
  ImageIcon,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bookingStatuses, currency, type Booking, type BookingStatus } from "@/lib/bookings";
import {
  deleteBooking,
  listBookings,
  updateBookingStatus,
  updateDepositStatus,
} from "@/lib/bookings.functions";
import { generateInvoicePdf } from "@/lib/invoice";
import { company, servicePackages, vehicleTypes } from "@/lib/servicesConfig";
import { BookingListSkeleton, AuditLogSkeleton, PricePanelSkeleton } from "@/components/skeletons";

const PricePanel = lazy(() =>
  import("@/components/PricePanel").then((m) => ({ default: m.PricePanel })),
);
const AuditLogPanel = lazy(() =>
  import("@/components/AuditLogPanel").then((m) => ({ default: m.AuditLogPanel })),
);
import { getSupabaseClient } from "@/integrations/supabase/get-client";
import { toast } from "sonner";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";
import { diagnoseBackendError, type BackendErrorInfo } from "@/lib/backendErrors";

export const Route = createFileRoute("/_authenticated/_admin/admin/")({
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoute,

  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function AdminRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <AdminPage />;
}

const statusStyles: Record<BookingStatus, string> = {
  Angefragt: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Bestätigt: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Ausstehend: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Bezahlt: "bg-primary/15 text-primary border-primary/40",
  Storniert: "bg-destructive/15 text-destructive border-destructive/40",
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfFor, setPdfFor] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [fatal, setFatal] = useState<BackendErrorInfo | null>(null);
  const [auditKey, setAuditKey] = useState(0);

  const fetchBookings = useServerFn(listBookings);
  const setStatusFn = useServerFn(updateBookingStatus);
  const setDepositFn = useServerFn(updateDepositStatus);
  const removeFn = useServerFn(deleteBooking);

  function reportError(error: unknown) {
    const info = diagnoseBackendError(error);
    if (info.missing.length > 0 || info.title === "Anmeldung erforderlich") {
      setFatal(info);
    }
    toast.error(info.description);
    return info;
  }

  useEffect(() => {
    let active = true;
    fetchBookings()
      .then((rows) => {
        if (active) setBookings(rows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const info = diagnoseBackendError(error);
        if (info.title === "Kein Administrator-Zugriff") setDenied(true);
        else setFatal(info);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fetchBookings]);

  async function setStatus(id: string, status: BookingStatus) {
    const previous = bookings;
    setBookings((list) => list.map((b) => (b.id === id ? { ...b, status } : b)));
    try {
      const updated = await setStatusFn({ data: { id, status } });
      setBookings((list) => list.map((b) => (b.id === id ? updated : b)));
      setAuditKey((k) => k + 1);
      toast.success(`Status auf „${status}“ gesetzt`);
    } catch (error) {
      setBookings(previous);
      reportError(error);
    }
  }

  async function markDepositPaid(id: string) {
    try {
      const updated = await setDepositFn({ data: { id, depositStatus: "bezahlt" } });
      setBookings((list) => list.map((b) => (b.id === id ? updated : b)));
      setAuditKey((k) => k + 1);
      toast.success("Anzahlung als bezahlt markiert");
    } catch (error) {
      reportError(error);
    }
  }

  async function remove(id: string) {
    const previous = bookings;
    setBookings((list) => list.filter((b) => b.id !== id));
    try {
      await removeFn({ data: { id } });
      setAuditKey((k) => k + 1);
      toast.success("Buchung gelöscht");
    } catch (error) {
      setBookings(previous);
      reportError(error);
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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

  const revenue = bookings.filter((b) => b.status !== "Storniert").reduce((s, b) => s + b.total, 0);
  const pendingConfirmation = bookings.filter((b) => b.status === "Angefragt").length;
  const openDeposits = bookings.filter((b) => b.depositStatus === "offen").length;

  if (fatal) {
    return <SupabaseConfigNotice info={fatal} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="display-sub truncate text-xl sm:text-2xl">Admin Dashboard</h1>
            <p className="truncate text-sm text-muted-foreground">
              Buchungen, Status und Rechnungen
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Zur Website</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Abmelden">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {denied ? (
          <div className="glass rounded-3xl p-12 text-center">
            <ShieldAlert className="mx-auto size-8 text-destructive" />
            <p className="display-card mt-4">Kein Administrator-Zugriff</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Ihr Konto besitzt keine Admin-Rolle. Bitte lassen Sie sich von einem bestehenden
              Administrator freischalten.
            </p>
            <Button variant="outline" className="mt-6" onClick={signOut}>
              Abmelden
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={Receipt} label="Buchungen gesamt" value={String(bookings.length)} />
              <Stat
                icon={CalendarClock}
                label="Zu bestätigen"
                value={String(pendingConfirmation)}
              />
              <Stat icon={Wallet} label="Offene Anzahlungen" value={String(openDeposits)} />
              <Stat icon={CircleDollarSign} label="Umsatz (brutto)" value={currency(revenue)} />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CalendarFeedCard />
              <Link
                to="/admin/kunden"
                className="glass flex flex-col justify-between rounded-2xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h2 className="display-card text-sm uppercase">Kundenakten</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Historie, Umsatz und Notizen je Kunde — automatisch aus den Buchungen
                  zusammengestellt.
                </p>
              </Link>
              <Link
                to="/admin/leistungen"
                className="glass flex flex-col justify-between rounded-2xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="display-card text-sm uppercase">Eigene Leistungen</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Zusätzliche Dienstleistungen selbst anlegen, bearbeiten oder als Entwurf
                  speichern.
                </p>
              </Link>
              <Link
                to="/admin/galerie"
                className="glass flex flex-col justify-between rounded-2xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-primary" />
                  <h2 className="display-card text-sm uppercase">Fahrzeuggalerie</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Vorher/Nachher-Fotos hochladen — erscheinen auf der Startseite als
                  Referenzgalerie.
                </p>
              </Link>
            </div>

            <ErrorBoundary title="Die Preisverwaltung konnte nicht geladen werden">
              <Suspense fallback={<PricePanelSkeleton />}>
                <PricePanel />
              </Suspense>
            </ErrorBoundary>

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

            {loading ? (
              <BookingListSkeleton />
            ) : filtered.length === 0 ? (
              <div className="glass mt-6 rounded-3xl p-12 text-center">
                <p className="display-card">Keine Buchungen vorhanden</p>
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
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="display-card">{b.customer.name}</span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[b.status]}`}
                            >
                              {b.status}
                            </span>
                            {b.isNewCustomer && (
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                                Neukunde
                              </span>
                            )}
                            {b.depositAmount > 0 && (
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                                  b.depositStatus === "bezahlt"
                                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                    : "border-amber-500/30 bg-amber-500/15 text-amber-300"
                                }`}
                              >
                                Anzahlung {currency(b.depositAmount)}
                                {b.depositStatus === "bezahlt" ? " bezahlt" : " offen"}
                              </span>
                            )}
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
                          <span className="display-price text-xl text-primary">
                            {currency(b.total)}
                          </span>
                          <select
                            aria-label="Status ändern"
                            value={b.status}
                            onChange={(e) => setStatus(b.id, e.target.value as BookingStatus)}
                            className="h-9 rounded-lg border border-border bg-secondary/50 px-2 text-sm"
                          >
                            {bookingStatuses.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          {b.status === "Angefragt" && (
                            <Button size="sm" onClick={() => setStatus(b.id, "Bestätigt")}>
                              <CheckCircle2 className="size-4" />
                              Bestätigen
                            </Button>
                          )}
                          {b.depositStatus === "offen" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markDepositPaid(b.id)}
                            >
                              <Wallet className="size-4" />
                              Anzahlung erhalten
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!company.legalDetailsVerified}
                            title={
                              company.legalDetailsVerified
                                ? "Rechnung herunterladen"
                                : "Zuerst geprüfte Firmen-, Steuer- und Bankdaten hinterlegen"
                            }
                            loading={pdfFor === b.id}
                            onClick={async () => {
                              setPdfFor(b.id);
                              try {
                                await generateInvoicePdf(b);
                              } finally {
                                setPdfFor(null);
                              }
                            }}
                          >
                            {pdfFor === b.id ? null : <Download className="size-4" />}
                            Rechnung
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Buchung löschen"
                            onClick={() => remove(b.id)}
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
            <ErrorBoundary title="Das Audit-Log konnte nicht geladen werden">
              <Suspense fallback={<AuditLogSkeleton />}>
                <AuditLogPanel key={auditKey} />
              </Suspense>
            </ErrorBoundary>
          </>
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
      <p className="display-price mt-3 text-xl sm:text-2xl">{value}</p>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
