import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { assertRateLimit } from "@/lib/rate-limit";
import { agentKey, analyzeBooking } from "@/lib/bitrix-agent.server";
import { BITRIX_AGENT_MODEL } from "@/lib/bitrix-agent";

export const bitrixAgentContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const bookings = await sql<{
      id: number;
      version: number;
      customer_name: string;
      status: string;
    }>`
      select id,version,customer_name,status from bookings where shop_id='white-gloss'
      order by created_at desc limit 100`;
    return { configured: Boolean(await agentKey(sql)), model: BITRIX_AGENT_MODEL, bookings };
  });

export const runBitrixAgent = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        requestId: z.uuid(),
        bookingId: z.number().int().positive().optional(),
        expectedVersion: z.number().int().positive().optional(),
        question: z.string().trim().min(3).max(2000),
        includePhotos: z.boolean().default(true),
      })
      .refine(
        (value) => Boolean(value.bookingId) === Boolean(value.expectedVersion),
        "Buchungsversion fehlt",
      )
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    assertRateLimit("bitrix-agent", context.userId, 12, 10 * 60_000);
    return analyzeBooking(await getSql(), context.userId, data);
  });
