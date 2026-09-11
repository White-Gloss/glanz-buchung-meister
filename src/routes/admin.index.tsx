import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { dashboardStats } from "@/lib/admin.functions";
import {
  confirmBooking,
  createManualBooking,
  getBookingPermissions,
  listBookings,
  updateBookingDetails,
  updateBookingStatus,
  type BookingRow,
} from "@/lib/bookings.functions";
import { bookingStatuses, cities, extras, packages, type BookingStatus } from "@/data/site";
import { eur } from "@/lib/utils";
import { Button, inputClass } from "@/components/ui";
import { AdminBookingEditor, type BookingEditValues } from "@/components/admin-booking-editor";
import { AdminBookingPhotos } from "@/components/admin-booking-photos";
import { AdminBookingHistory } from "@/components/admin-booking-history";

export const Route = createFileRoute("/admin/")({
  component: AdminBookings,
});

function extraLabel(raw: string) {
  try {
    const ids = JSON.parse(raw) as string[];
    return extras
      .filter((e) => ids.includes(e.id))
      .map((e) => e.name)
      .join(", ");
  } catch {
    return "";
  }
}

function AdminBookings() {
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof dashboardStats>> | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"alle" | BookingStatus>("alle");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [canConfirm, setCanConfirm] = useState(false);
  const [actionError, setActionError] = useState<{ id: number; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const createRequestId = useRef<string | null>(null);
  const returnToCreateButton = useRef(false);
  const mutating = useRef(false);
  const returnFocus = useRef<number | null>(null);
  const selectedHash = useRouterState({ select: (state) => state.location.hash });
  const focusedHash = useRef("");

  useEffect(() => {
    if (!/^booking-\d+$/.test(selectedHash) || selectedHash === focusedHash.current) return;
    const target = document.getElementById(selectedHash);
    if (target) {
      target.focus();
      target.scrollIntoView({ block: "nearest" });
      focusedHash.current = selectedHash;
    }
  }, [rows, selectedHash]);

  useEffect(() => {
    if (editing === null && returnFocus.current !== null) {
      document.getElementById(`edit-booking-${returnFocus.current}`)?.focus();
      returnFocus.current = null;
    }
  }, [editing]);

  useEffect(() => {
    if (!creating && pending === null && returnToCreateButton.current) {
      document.getElementById("add-booking")?.focus();
      returnToCreateButton.current = false;
    }
  }, [creating, pending]);

  async function reload() {
    const [bookings, dash, permissions] = await Promise.all([
      listBookings(),
      dashboardStats(),
      getBookingPermissions(),
    ]);
    setRows(bookings);
    setStats(dash);
    setCanConfirm(permissions.canConfirm);
  }

  async function change(row: BookingRow, action: () => Promise<unknown>, message: string) {
    if (mutating.current) return false;
    mutating.current = true;
    setPending(row.id);
    setActionError(null);
    setNotice("");
    try {
      await action();
      await reload();
      setNotice(`WG-${row.id}: ${message}`);
      return true;
    } catch (error) {
      setActionError({
        id: row.id,
        message:
          error instanceof Error
            ? error.message
            : "Änderung fehlgeschlagen. Bitte erneut versuchen.",
      });
      return false;
    } finally {
      mutating.current = false;
      setPending(null);
    }
  }

  function closeEditor(id: number) {
    returnFocus.current = id;
    setEditing(null);
  }

  async function addBooking(values: BookingEditValues) {
    if (mutating.current) return;
    mutating.current = true;
    setPending(0);
    setCreateError("");
    try {
      createRequestId.current ??= crypto.randomUUID();
      const result = await createManualBooking({
        data: {
          idempotencyKey: createRequestId.current,
          name: values.name,
          phone: values.phone,
          email: values.email,
          date: values.date,
          slot: values.slot,
          packageId: values.packageId,
          classId: values.classId,
          extraIds: values.extraIds,
          citySlug: values.citySlug,
          note: values.note,
          kind: "booking",
          notifyCustomer: !!values.notifyCustomer && !!values.email.trim(),
        },
      });
      // The write succeeded; a failed list refresh must never invite another creation.
      createRequestId.current = null;
      returnToCreateButton.current = true;
      setCreating(false);
      setFilter("alle");
      setQuery("");
      setNotice(`WG-${result.id}: Manuell angelegt. Wartet auf Bestätigung.`);
      try {
        await reload();
      } catch {
        setError(
          "Buchung gespeichert. Die Liste konnte nicht neu geladen werden. Bitte die Seite aktualisieren.",
        );
      }
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Buchung konnte nicht gespeichert werden.",
      );
    } finally {
      mutating.current = false;
      setPending(null);
    }
  }

  useEffect(() => {
    void reload().catch(() => setError("Buchungen konnten nicht geladen werden."));
  }, []);

  const visible = useMemo(() => {
    const list = rows?.filter((r) => (filter === "alle" ? true : r.status === filter)) ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.customer_name, r.phone, r.email ?? "", String(r.id), `WG-${r.id}`, r.package_id]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, filter, query]);

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Tagesgeschäft</p>
          <h1 className="mt-2 font-display text-4xl">Buchungen</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Jede Anfrage wartet auf persönliche Prüfung. Nur der Inhaber kann einen Termin
            ausdrücklich bestätigen. Änderungen und Benachrichtigungen laufen danach automatisch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            id="add-booking"
            type="button"
            disabled={pending !== null || creating}
            onClick={() => {
              setEditing(null);
              setCreateError("");
              setCreating(true);
            }}
          >
            Buchung hinzufügen
          </Button>
          {(["alle", ...bookingStatuses.map((s) => s.id)] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`min-h-11 rounded-full px-4 text-sm ${
                filter === id ? "bg-accent text-accent-fg" : "border border-line text-muted"
              }`}
            >
              {id === "alle" ? "Alle" : bookingStatuses.find((s) => s.id === id)?.label}
            </button>
          ))}
        </div>
      </div>

      {creating ? (
        <section
          className="mt-6 rounded-md border border-line bg-surface p-5"
          aria-label="Neue manuelle Buchung"
        >
          {createError ? (
            <p role="alert" className="text-sm text-red-600">
              {createError}
            </p>
          ) : null}
          <AdminBookingEditor
            pending={pending === 0}
            onSave={addBooking}
            onCancel={() => {
              returnToCreateButton.current = true;
              setCreating(false);
              createRequestId.current = null;
            }}
          />
        </section>
      ) : null}

      {stats ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Wartet auf Bestätigung", String(stats.neu), "/admin/posteingang"] as const,
            ["Heute", String(stats.today), "/admin/kalender"] as const,
            ["Ungelesen", String(stats.unread), "/admin/posteingang"] as const,
            ["Bestätigt", eur(stats.confirmedCents / 100), "/admin/odoo"] as const,
          ].map(([t, v, to]) => (
            <Link
              key={t}
              to={to}
              className="rounded-md border border-line bg-surface p-4 hover:border-fg"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-subtle">{t}</p>
              <p className="mt-2 font-display text-3xl">{v}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {stats ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["E-Mail Ausgang", stats.outboundEmail],
            ["WhatsApp Ausgang", stats.outboundWhatsapp],
            ["Telegram Ausgang", stats.outboundTelegram],
          ].map(([t, v]) => (
            <Link
              key={t}
              to="/admin/automatisierung"
              className="rounded-md border border-line bg-bg p-4 hover:border-fg"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-subtle">{t}</p>
              <p className="mt-1 font-display text-2xl">{v}</p>
            </Link>
          ))}
        </div>
      ) : null}

      <label className="mt-8 block">
        <span className="sr-only">Buchungen durchsuchen</span>
        <input
          className={inputClass}
          value={query}
          maxLength={80}
          placeholder="Name, Telefon, E-Mail oder WG-Nummer"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {error ? (
        <p className="mt-6 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-6 text-sm text-fg" role="status">
          {notice}
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="mt-4"
        disabled={pending !== null}
        onClick={() => {
          setEditing(null);
          setActionError(null);
          void reload()
            .then(() => setError(""))
            .catch(() => setError("Buchungen konnten nicht aktualisiert werden."));
        }}
      >
        Aktualisieren
      </Button>
      {rows === null && !error ? (
        <p className="mt-8 text-sm text-muted">Laden …</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 rounded-md border border-line bg-surface p-6 text-sm text-muted">
          Keine passenden Anfragen. Neue Buchungen erscheinen hier mit „Wartet auf Bestätigung“.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {visible.map((row) => {
            const pack = packages.find((p) => p.id === row.package_id);
            const city = cities.find((c) => c.slug === row.city_slug);
            const extra = extraLabel(row.extra_ids);
            return (
              <li
                key={row.id}
                id={`booking-${row.id}`}
                tabIndex={-1}
                className={`min-w-0 scroll-mt-24 break-words rounded-md border bg-surface p-5 ${row.status === "neu" ? "border-accent" : "border-line"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 max-w-full flex-1">
                    <p className="text-xs text-subtle">WG-{row.id}</p>
                    <p className="mt-1 text-sm font-medium">
                      {bookingStatuses.find((status) => status.id === row.status)?.label ??
                        row.status}
                    </p>
                    <h2 className="break-words font-display text-2xl">{row.customer_name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      <a href={`tel:${row.phone}`} className="hover:text-fg">
                        {row.phone}
                      </a>
                      {row.email ? (
                        <>
                          {" · "}
                          <a href={`mailto:${row.email}`} className="hover:text-fg">
                            {row.email}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <p className="font-display text-2xl">{eur(row.total_cents / 100)}</p>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {pack?.name ?? row.package_id} · {row.class_id}
                  {city ? ` · ${city.name}` : ""}
                  {row.preferred_date
                    ? ` · ${row.preferred_date}${row.preferred_slot ? ` ${row.preferred_slot}` : ""}`
                    : ""}
                  {extra ? ` · ${extra}` : ""}
                </p>
                <AdminBookingPhotos bookingId={row.id} />
                <Link to="/admin/unterlagen" className="mt-2 inline-block text-sm underline">
                  Rechnungen in Lexware verwalten
                </Link>
                {row.note ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-fg">{row.note}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {row.status === "neu" && canConfirm ? (
                    <Button
                      type="button"
                      disabled={pending !== null || editing !== null}
                      onClick={async () => {
                        await change(
                          row,
                          () =>
                            confirmBooking({ data: { id: row.id, expectedVersion: row.version } }),
                          "Termin persönlich bestätigt.",
                        );
                      }}
                    >
                      Bestätigen
                    </Button>
                  ) : null}
                  {(row.status === "neu"
                    ? [{ id: "abgelehnt", label: "Ablehnen" }]
                    : row.status === "bestaetigt"
                      ? [
                          { id: "storniert", label: "Stornieren" },
                          { id: "erledigt", label: "Als erledigt markieren" },
                          { id: "nicht_erschienen", label: "Nicht erschienen" },
                        ]
                      : []
                  ).map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant="ghost"
                      className="px-3"
                      disabled={pending !== null || editing !== null}
                      onClick={async () => {
                        await change(
                          row,
                          () =>
                            updateBookingStatus({
                              data: {
                                id: row.id,
                                status: s.id as BookingStatus,
                                expectedVersion: row.version,
                              },
                            }),
                          "Status aktualisiert.",
                        );
                      }}
                    >
                      {s.label}
                    </Button>
                  ))}
                  {row.status === "neu" || row.status === "bestaetigt" ? (
                    <Button
                      id={`edit-booking-${row.id}`}
                      type="button"
                      variant="ghost"
                      disabled={pending !== null || editing !== null}
                      aria-expanded={editing === row.id}
                      onClick={() => {
                        setActionError(null);
                        setEditing(row.id);
                      }}
                    >
                      Bearbeiten
                    </Button>
                  ) : null}
                </div>
                {row.status === "neu" && !canConfirm ? (
                  <p className="mt-3 text-sm text-muted">
                    Die Bestätigung ist dem Inhaberkonto vorbehalten.
                  </p>
                ) : null}
                {actionError?.id === row.id ? (
                  <p className="mt-3 text-sm text-danger" role="alert">
                    {actionError.message} Bei zwischenzeitlichen Änderungen bitte die Buchungen
                    aktualisieren.
                  </p>
                ) : null}
                {editing === row.id ? (
                  <AdminBookingEditor
                    key={`${row.id}-${row.version}`}
                    row={row}
                    pending={pending !== null}
                    onCancel={() => closeEditor(row.id)}
                    onSave={async (values) => {
                      if (
                        await change(
                          row,
                          () => updateBookingDetails({ data: values }),
                          "Änderungen gespeichert. Bitte den aktuellen Status beachten.",
                        )
                      )
                        closeEditor(row.id);
                    }}
                  />
                ) : null}
                {row.status === "bestaetigt" ? (
                  <p className="mt-3 text-xs text-subtle">
                    Bestätigt
                    {row.confirmed_at
                      ? ` am ${new Date(row.confirmed_at).toLocaleString("de-DE")}`
                      : ""}
                    . Benachrichtigungen und Kalender folgen der Freigabe.
                  </p>
                ) : null}
                <AdminBookingHistory bookingId={row.id} version={row.version} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
