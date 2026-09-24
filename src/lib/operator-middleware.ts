import { createMiddleware } from "@tanstack/react-start";
import { requireOperator } from "@/lib/operator";
import { bitrixOnlyEnabled } from "@/lib/booking-backend";

/**
 * Zweite Stufe nach authMiddleware: angemeldet reicht nicht.
 * Nur Betriebs-Konten dürfen Kunden- und Auftragsdaten sehen.
 */
export const operatorMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const userId = (context as unknown as { userId?: string }).userId;
    if (!userId) throw new Error("Kein Betriebszugang.");
    await requireOperator(userId);
    return next();
  },
);

/**
 * Für Schreibzugriffe der Altsysteme (Website-Leitstand, Zoho, Lexware, Odoo,
 * RO, ERPNext, Hub): im Bitrix-Betrieb ist Bitrix24 das einzige führende System.
 */
export const legacyOperatorMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const userId = (context as unknown as { userId?: string }).userId;
    if (!userId) throw new Error("Kein Betriebszugang.");
    await requireOperator(userId);
    if (bitrixOnlyEnabled())
      throw new Error("Die Auftragsverwaltung erfolgt ausschließlich in Bitrix24.");
    return next();
  },
);
