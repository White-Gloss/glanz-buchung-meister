import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireOperator } from "@/lib/operator";

export const getOperatorAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      await requireOperator(context.userId);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });
