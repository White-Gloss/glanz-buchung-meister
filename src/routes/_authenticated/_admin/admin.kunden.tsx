import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Car, Mail, Phone, Save, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listBookings } from "@/lib/bookings.functions";
import { listCustomerNotes, saveCustomerNote } from "@/lib/customerNotes.functions";
import { deriveCustomers, daysSinceLastBooking, type CustomerSummary } from "@/lib/customers";
import { currency, servicePackages } from "@/lib/servicesConfig";
import type { Booking } from "@/lib/bookings";
import { diagnoseBackendError } from "@/lib/backendErrors";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

export const Route = createFileRoute("/_authenticated/_admin/admin/kunden")({
  head: () => ({
    meta: [
      { title: "Kundenakten – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomersRoute,
  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function CustomersRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <CustomersPage />;
}

type NoteRow = { customer_email: string; note: string; updated_at: string };

function CustomersPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const fetchBookings = useServerFn(listBookings);
  const fetchNotes = useServerFn(listCustomerNotes);

  useEffect(() => {
    void Promise.all([fetchBookings({}), fetchNotes({})]).then(([b, n]) => {
      setBookings(b);
      setNotes(new Map((n as NoteRow[]).map((row) => [row.customer_email, row.note])));
    });
  }, [fetchBookings, fetchNotes]);

  const customers = useMemo(() => (bookings ? deriveCustomers(bookings) : []), [bookings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.includes(q) ||
        c.plates.some((p) => p.toLowerCase().includes(q)),
    );
  }, [customers, query]);

  const active = customers.find((c) => c.email === selected) ?? null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/admin">
              <ArrowLeft className="size-4" />
              Zurück
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h1 className="display-card text-sm uppercase">Kundenakten</h1>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {bookings === null ? (
          <p className="text-sm text-muted-foreground">Wird geladen …</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <section>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, E-Mail oder Kennzeichen …"
                  className="h-11 bg-secondary/40 pl-9"
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {filtered.length} von {customers.length} Kunden
              </p>
              <ul className="mt-3 max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
                {filtered.map((c) => (
                  <li key={c.email}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.email)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        selected === c.email
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-secondary/20 hover:bg-secondary/40"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.bookingCount} {c.bookingCount === 1 ? "Termin" : "Termine"} ·{" "}
                        {currency(c.totalRevenue)}
                      </p>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Keine Treffer
                  </li>
                )}
              </ul>
            </section>

            <section>
              {active ? (
                <CustomerDetail
                  customer={active}
                  note={notes.get(active.email) ?? ""}
                  onNoteSaved={(text) => setNotes((prev) => new Map(prev).set(active.email, text))}
                />
              ) : (
                <div className="glass flex h-full min-h-[300px] items-center justify-center rounded-2xl p-12 text-center text-sm text-muted-foreground">
                  Kunde aus der Liste wählen
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function CustomerDetail({
  customer,
  note,
  onNoteSaved,
}: {
  customer: CustomerSummary;
  note: string;
  onNoteSaved: (text: string) => void;
}) {
  const [draft, setDraft] = useState(note);
  const [saving, setSaving] = useState(false);
  const saveNote = useServerFn(saveCustomerNote);
  const days = daysSinceLastBooking(customer);

  useEffect(() => setDraft(note), [note, customer.email]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveNote({ data: { email: customer.email, note: draft } });
      onNoteSaved(draft.trim());
      toast.success("Notiz gespeichert.");
    } catch {
      toast.error("Notiz konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5">
        <h2 className="display-card text-lg">{customer.name}</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            <a href={`mailto:${customer.email}`} className="hover:text-foreground">
              {customer.email}
            </a>
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-3.5 shrink-0" />
            <a href={`tel:${customer.phone}`} className="hover:text-foreground">
              {customer.phone}
            </a>
          </p>
          <p className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
            <Car className="size-3.5 shrink-0" />
            {customer.plates.join(", ")}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Termine</p>
            <p className="display-price mt-1 text-lg">{customer.bookingCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Umsatz</p>
            <p className="display-price mt-1 text-lg">{currency(customer.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {days < 0 ? "Nächster Termin" : "Letzter Termin"}
            </p>
            <p className="mt-1 text-sm text-foreground">
              {days < 0
                ? `in ${Math.abs(days)} ${Math.abs(days) === 1 ? "Tag" : "Tagen"}`
                : days === 0
                  ? "heute"
                  : `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`}
            </p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="display-card text-sm uppercase">Notiz</h3>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="z. B. Keramikversiegelung im Mai, Auffrischung nach 12 Monaten anbieten"
          className="mt-3 w-full rounded-xl border border-border bg-secondary/30 p-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          onClick={handleSave}
          disabled={draft.trim() === note.trim()}
          loading={saving}
          size="sm"
          className="mt-3 gap-1.5"
        >
          <Save className="size-3.5" />
          Speichern
        </Button>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="display-card text-sm uppercase">Historie</h3>
        <ul className="mt-3 space-y-2">
          {customer.bookings.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-2.5 text-sm"
            >
              <div>
                <p className="text-foreground">
                  {servicePackages.find((p) => p.id === b.packageId)?.name ?? b.packageId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.date} · {b.invoiceNumber}
                </p>
              </div>
              <div className="text-right">
                <p className="text-foreground">{currency(b.total)}</p>
                <p className="text-xs text-muted-foreground">{b.status}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
