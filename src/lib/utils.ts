import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number) {
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value);
}

export function eur(value: number) {
  return `${money(value)} €`;
}

export function stamp(value: unknown) {
  if (value == null) return "";
  const raw =
    typeof value === "string"
      ? value
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  return raw.slice(0, 16).replace("T", " ");
}
