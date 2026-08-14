export function bookingProgress(step: number, total: number) {
  const now = Math.min(Math.max(step + 1, 1), total);
  return {
    now,
    min: 1,
    max: total,
    percent: (now / total) * 100,
    label: `Schritt ${now} von ${total}`,
  };
}
