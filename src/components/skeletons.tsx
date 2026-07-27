import { Skeleton } from "@/components/ui/skeleton";

/** Platzhalter in Struktur der Buchungskarten im Admin-Dashboard. */
export function BookingListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-6 space-y-4" aria-busy="true" aria-label="Buchungen werden geladen">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Platzhalter in Struktur der Audit-Log-Zeilen. */
export function AuditLogSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="mt-5 space-y-2" aria-busy="true" aria-label="Audit-Log wird geladen">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="grid gap-2 rounded-xl border border-border bg-secondary/30 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
        >
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-24 sm:justify-self-end" />
        </li>
      ))}
    </ul>
  );
}

/** Platzhalter in Struktur des Buchungs-Assistenten. */
export function BookingWizardSkeleton() {
  return (
    <div className="glass rounded-3xl p-5 sm:p-8" aria-busy="true" aria-label="Buchungsassistent wird geladen">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-6 h-8 w-64" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
      <div className="mt-8 flex justify-between">
        <Skeleton className="h-11 w-32 rounded-md" />
        <Skeleton className="h-11 w-32 rounded-md" />
      </div>
    </div>
  );
}

/** Platzhalter für das Preis-Panel im Admin-Dashboard. */
export function PricePanelSkeleton() {
  return (
    <div className="glass mt-8 rounded-3xl p-5 sm:p-6" aria-busy="true" aria-label="Preise werden geladen">
      <Skeleton className="h-6 w-40" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
