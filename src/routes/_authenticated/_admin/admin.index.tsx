import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CalendarFeedCard } from "@/components/CalendarFeedCard";
import { MailStatusCard } from "@/components/MailStatusCard";
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
  HelpCircle,
  FileText,
  Camera,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currency, type Booking, type BookingStatus } from "@/lib/bookings";
import {
  confirmBooking,
  deleteBooking,
  getAvailableDates,
  listBookings,
  sendCounterOffer,
  updateBookingStatus,
  updateDepositStatus,
} from "@/lib/bookings.functions";
import { getConditionPhotoUrls, listConditionReports } from "@/lib/conditionReports.functions";
import { BookingCard } from "@/components/BookingCard";
import { generateInvoicePdf } from "@/lib/invoice";
import { company } from "@/lib/servicesConfig";
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

  // Tagesauslastung für „x von 3 Plätzen belegt" und die Ersatzterminwahl.
  const [dayLoad, setDayLoad] = useState<Record<string, number>>({});
  // Buchung -> Zahl der Zustandsfotos, plus Buchung -> Meldungs-ID für den
  // Abruf der signierten Adressen beim Aufklappen.
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [reportIds, setReportIds] = useState<Record<string, string>>({});

  const fetchBookings = useServerFn(listBookings);
  const fetchDayLoad = useServerFn(getAvailableDates);
  const fetchReports = useServerFn(listConditionReports);
  const fetchPhotoUrls = useServerFn(getConditionPhotoUrls);
  const setStatusFn = useServerFn(updateBookingStatus);
  const setDepositFn = useServerFn(updateDepositStatus);
  const removeFn = useServerFn(deleteBooking);
  const confirmFn = useServerFn(confirmBooking);
  const offerFn = useServerFn(sendCounterOffer);

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

  // Auslastung und Fotobestand ergänzen. Beides ist Beiwerk: schlägt es
  // fehl, bleibt die Buchungsliste trotzdem benutzbar.
  useEffect(() => {
    let active = true;
    void fetchDayLoad({})
      .then((load) => active && setDayLoad(load))
      .catch(() => undefined);
    void fetchReports({})
      .then((reports) => {
        if (!active) return;
        const counts: Record<string, number> = {};
        const ids: Record<string, string> = {};
        for (const report of reports) {
          if (!report.booking_id) continue;
          counts[report.booking_id] = report.photo_paths.length;
          ids[report.booking_id] = report.id;
        }
        setPhotoCounts(counts);
        setReportIds(ids);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [fetchDayLoad, fetchReports]);

  async function loadPhotos(bookingId: string): Promise<string[]> {
    const reportId = reportIds[bookingId];
    if (!reportId) return [];
    try {
      return await fetchPhotoUrls({ data: { id: reportId } });
    } catch (error) {
      reportError(error);
      return [];
    }
  }

  /** Wunschtermin und Standardpreis unverändert zusagen. */
  async function confirmDirect(id: string) {
    try {
      const updated = await confirmFn({ data: { id } });
      setBookings((list) => list.map((b) => (b.id === id ? updated : b)));
      setAuditKey((k) => k + 1);
      toast.success("Termin bestätigt – der Kunde hat die Zusage per E-Mail erhalten.");
    } catch (error) {
      reportError(error);
    }
  }

  /** Gegenangebot mit Preis, Begründung und Ersatzterminen senden. */
  async function sendOffer(id: string, price: number | null, note: string, altDates: string[]) {
    try {
      const updated = await offerFn({ data: { id, price, note, altDates } });
      setBookings((list) => list.map((b) => (b.id === id ? updated : b)));
      setAuditKey((k) => k + 1);
      toast.success("Angebot verschickt – der Kunde wählt jetzt einen Termin.");
    } catch (error) {
      reportError(error);
    }
  }

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
  const pendingConfirmation = bookings.filter((b) => b.status === "Wartend auf Prüfung").length;
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
              <Link
                to="/admin/zustand"
                className="glass flex flex-col justify-between rounded-2xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <Camera className="size-4 text-primary" />
                  <h2 className="display-card text-sm uppercase">Zustandsmeldungen</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Fotos und Zustandsbeschreibungen, die Interessenten vor der Buchung geschickt
                  haben.
                </p>
              </Link>
              <Link
                to="/admin/faqs"
                className="glass flex flex-col justify-between rounded-2xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="size-4 text-primary" />
                  <h2 className="display-card text-sm uppercase">FAQs</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Häufige Fragen pflegen und sortieren — erscheinen auf /faq und als FAQ-Rich-Result
                  bei Google.
                </p>
              </Link>
              <Link
                to="/admin/blog"
                className="glass flex flex-col justify-between rounded-2xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <h2 className="display-card text-sm uppercase">Ratgeber</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Blog-Beiträge schreiben, Bilder hochladen und Meta-Angaben für Google und Social
                  Media setzen.
                </p>
              </Link>
            </div>

            <ErrorBoundary title="Der E-Mail-Status konnte nicht geladen werden">
              <MailStatusCard />
            </ErrorBoundary>

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
                {filtered.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    dayLoad={dayLoad}
                    photoCount={photoCounts[b.id] ?? 0}
                    invoiceBusy={pdfFor === b.id}
                    legalDetailsVerified={company.legalDetailsVerified}
                    actions={{
                      onStatus: setStatus,
                      onConfirm: confirmDirect,
                      onCounterOffer: sendOffer,
                      onDepositPaid: markDepositPaid,
                      onDelete: remove,
                      onInvoice: async (booking) => {
                        setPdfFor(booking.id);
                        try {
                          await generateInvoicePdf(booking);
                        } finally {
                          setPdfFor(null);
                        }
                      },
                      onLoadPhotos: loadPhotos,
                    }}
                  />
                ))}
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
