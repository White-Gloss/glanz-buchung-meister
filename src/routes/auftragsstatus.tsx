import { createFileRoute } from "@tanstack/react-router";
import { BookingStatus } from "@/components/booking-status";
export const Route = createFileRoute("/auftragsstatus")({
  validateSearch: (search: Record<string, unknown>) => ({
    vorgang:
      typeof search.vorgang === "string" && /^WG-\d{1,10}$/.test(search.vorgang)
        ? search.vorgang
        : "",
    token: typeof search.token === "string" ? search.token.slice(0, 100) : "",
  }),
  head: () => ({
    meta: [
      { title: "Ihr Auftragsstatus | White Gloss" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: StatusPage,
});
function StatusPage() {
  const { vorgang, token } = Route.useSearch();
  return (
    <main id="main-content" className="section mx-auto max-w-3xl px-4" tabIndex={-1}>
      <h1 className="font-display text-3xl">Ihr Auftrag {vorgang}</h1>
      {vorgang && token ? (
        <BookingStatus id={Number(vorgang.slice(3))} token={token} />
      ) : (
        <p className="mt-6">
          Bitte öffnen Sie den persönlichen Link aus Ihrer Eingangsbestätigung.
        </p>
      )}
    </main>
  );
}
