import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listCustomers, updateCustomerNotes, type CustomerRow } from "@/lib/admin.functions";
import { Button, inputClass } from "@/components/ui";

export const Route = createFileRoute("/admin/kunden")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void listCustomers().then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Tagesgeschäft</p>
      <h1 className="mt-2 font-display text-4xl">Kundenakten</h1>
      {rows === null ? (
        <p className="mt-8 text-sm text-muted">Laden …</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Noch keine Kunden. Anfragen legen Akten automatisch an.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {rows.map((c) => (
            <li key={c.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{c.name}</h2>
                  <p className="text-sm text-muted">
                    {c.phone}
                    {c.email ? ` · ${c.email}` : ""} · {c.booking_count} Anfragen
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(c.id);
                    setNotes(c.notes ?? "");
                  }}
                >
                  Notiz
                </Button>
              </div>
              {c.notes ? <p className="mt-2 text-sm text-fg">{c.notes}</p> : null}
              {editing === c.id ? (
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await updateCustomerNotes({ data: { id: c.id, notes } });
                    setRows(await listCustomers());
                    setEditing(null);
                  }}
                >
                  <textarea
                    className={`${inputClass} min-h-20 py-2`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <Button type="submit">Speichern</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
