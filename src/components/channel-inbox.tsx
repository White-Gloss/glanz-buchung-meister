import { useEffect, useState } from "react";
import { listInbox, markInboxRead, replyInbox, type InboxRow } from "@/lib/admin.functions";
import { Button, inputClass } from "./ui";
import { stamp } from "@/lib/utils";

export function ChannelInbox({
  channel,
  heading,
  kicker,
  hint,
}: {
  channel: string;
  heading: string;
  kicker: string;
  hint: string;
}) {
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  async function reload() {
    const all = await listInbox();
    setRows(all.filter((r) => r.channel === channel));
  }

  useEffect(() => {
    void reload().catch(() => setRows([]));
  }, [channel]);

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">{kicker}</p>
      <h1 className="mt-2 font-display text-4xl">{heading}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{hint}</p>
      {rows === null ? (
        <p className="mt-8 text-sm text-muted">Laden …</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Keine Meldungen in diesem Kanal.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="rounded-md border border-line bg-surface p-5">
              <p className="text-xs text-subtle">{stamp(m.created_at)}</p>
              <h2 className="mt-1 font-display text-2xl">{m.subject}</h2>
              <p className="text-sm text-muted">{m.sender}</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm">{m.body}</pre>
              <div className="mt-4 flex flex-wrap gap-2">
                {!m.read_at ? (
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
                <Button type="button" variant="ghost" onClick={() => setOpen(m.id)}>
                  Antworten
                </Button>
              </div>
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
