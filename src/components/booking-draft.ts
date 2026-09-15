import { useEffect, useState } from "react";

// Browser memory only: survives route changes, never persisted to disk or shared
// between server requests. File objects stay available while this tab is open.
const values = new Map<string, unknown>();
export const appliedBookingEntries = new Set<string>();

export function useBookingDraft<T>(key: string, fallback: T) {
  const state = useState<T>(() =>
    typeof window !== "undefined" && values.has(key) ? (values.get(key) as T) : fallback,
  );
  const value = state[0];
  useEffect(() => {
    values.set(key, value);
  }, [key, value]);
  return state;
}

export function clearBookingDraft(prefix?: string) {
  if (prefix) {
    for (const key of values.keys()) if (key.startsWith(prefix)) values.delete(key);
  } else {
    values.clear();
    appliedBookingEntries.clear();
  }
}
