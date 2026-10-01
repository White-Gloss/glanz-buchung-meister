/** Kennungen der Widerrufsfunktion (§ 356a BGB); bewusst ohne Abhängigkeiten. */
export const WITHDRAWAL_RECEIVED = "withdrawal.received";
export const WITHDRAWAL_OWNER = "withdrawal.owner";

/** Nur die Eingangsbestätigung an den Verbraucher darf als Kundenmail raus. */
export function isWithdrawalCustomerMessage(
  key: string | null | undefined,
  event: string | null | undefined,
): boolean {
  return (
    event === WITHDRAWAL_RECEIVED &&
    typeof key === "string" &&
    /^withdrawal:WR-[0-9A-F]{10}:customer:email$/.test(key)
  );
}
