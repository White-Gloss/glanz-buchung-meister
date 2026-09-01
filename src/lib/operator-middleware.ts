import { createMiddleware } from "@tanstack/react-start";
import { requireOperator } from "@/lib/operator";

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
