import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings, requireBookingOwner } from "@/lib/booking-owner";
import { readVibeAiKey, runVibeAgent, type AgentRun } from "@/lib/vibe-agent.server";
import { probeVibeAiKey, VIBE_AI_MODEL } from "@/lib/vibe-ai";
import { assertRateLimit } from "@/lib/rate-limit";

export const vibeAgentStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const bookings = await sql<{ id: number; customer_name: string; status: string }>`
      select id,customer_name,status from bookings where shop_id='white-gloss' order by id desc limit 80`;
    return {
      configured: Boolean(await readVibeAiKey(sql)),
      model: VIBE_AI_MODEL,
      canManage: await canConfirmBookings(sql, context.userId),
      bookings,
    };
  });

export const saveVibeAiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((v: unknown) => z.object({ apiKey: z.string().trim().max(400) }).parse(v))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await requireBookingOwner(sql, context.userId);
    assertRateLimit("vibe-key", context.userId, 5);
    const key = await probeVibeAiKey(data.apiKey);
    await sql`update shop_settings set vibe_ai_api_key=${key},updated_at=now() where shop_id='white-gloss'`;
    return { ok: true };
  });

export const askVibeAgent = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((v: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        question: z.string().trim().min(1).max(2000),
        bookingId: z.number().int().positive().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    return runVibeAgent(await getSql(), context.userId, data);
  });

export const vibeAgentResult = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((v: unknown) => z.object({ requestId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const [row] = await sql<AgentRun>`select status,result,error from vibe_agent_runs
      where shop_id='white-gloss' and user_id=${context.userId} and request_id=${data.requestId}::uuid`;
    return row ?? null;
  });
