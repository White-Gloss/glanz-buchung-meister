import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listInbox, markInboxRead, replyInbox, type InboxRow } from "@/lib/admin.functions";
import { Button, inputClass } from "@/components/ui";
import { stamp } from "@/lib/utils";

export const Route = createFileRoute("/admin/posteingang")({
  component: AdminInbox,
});

function AdminInbox() {
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  async function reload() {
    setRows(await listInbox());
  }

  useEffect(() => {
    void reload().catch(() => setRows([]));
  }, []);

  const unread = rows?.filter((r) => !r.read_at && r.direction !== "out").length ?? 0;

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Kommunikation</p>
      <h1 className="mt-2 font-display text-4xl">Posteingang</h1>
      <p className="mt-2 text-sm text-muted">
        Formularanfragen, Foto-Begutachtungen und ausgehende Bestätigungen in einer Liste.
        {unread ? ` ${unread} ungelesen.` : ""}
      </p>
      {rows === null ? (
        <p className="mt-8 text-sm text-muted">Laden …</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Keine Nachrichten.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((m) => (
            <li
              key={m.id}
              className={`rounded-md border p-5 ${
                m.direction === "out"
                  ? "border-line bg-bg"
                  : m.read_at
                    ? "border-line bg-surface"
                    : "border-accent bg-elevated"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-subtle">
                    {m.direction === "out" ? "Ausgang" : "Eingang"} · {m.channel} · {stamp(m.created_at)}
                  </p>
                  <h2 className="mt-1 font-display text-2xl">{m.subject ?? "Nachricht"}</h2>
                  <p className="text-sm text-muted">{m.sender}</p>
                </div>
                {m.direction !== "out" && !m.read_at ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={async () => {
                      await markInboxRead({ data: { id: m.id } });
                      await reload();
                    }}
                  >
                    Gelesen
                  </Button>
                ) : null}
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg">
                {m.body}
              </pre>
              {m.direction !== "out" ? (
                <Button type="button" variant="ghost" className="mt-3" onClick={() => setOpen(m.id)}>
                  Antworten
                </Button>
              ) : null}
              {open === m.id ? (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await replyInbox({ data: { id: m.id, body: reply } });
                    setReply("");
                    setOpen(null);
                    await reload();
                  }}
                >
                  <textarea
                    className={`${inputClass} min-h-24 py-2`}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    required
                  />
                  <Button type="submit">Senden</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
