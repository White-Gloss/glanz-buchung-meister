import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { assertRateLimit } from "@/lib/rate-limit";
import { agentKey, analyzeBooking } from "@/lib/bitrix-agent.server";
import { BITRIX_AGENT_MODEL } from "@/lib/bitrix-agent";
import { canConfirmBookings, requireBookingOwner } from "@/lib/booking-owner";
import { ensureBookingAgentSchema } from "@/lib/bitrix-agent-schema";

export const bitrixAgentContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const bookings = await sql<{
      id: number;
      version: number;
      customer_name: string;
      status: string;
    }>`
      select id,version,customer_name,status from bookings where shop_id='white-gloss'
      order by created_at desc limit 100`;
    return {
      configured: Boolean(await agentKey(sql)),
      model: BITRIX_AGENT_MODEL,
      bookings,
      canManage: await canConfirmBookings(sql, context.userId),
    };
  });

export const saveBitrixAgentKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        apiKey: z
          .string()
          .trim()
          .min(20)
          .max(1024)
          .regex(/^vibe_api_[A-Za-z0-9_-]+$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await requireBookingOwner(sql, context.userId);
    assertRateLimit("bitrix-agent-key", context.userId, 6, 10 * 60_000);
    let available = false;
    try {
      const response = await fetch("https://vibecode.bitrix24.com/v1/me", {
        headers: { "X-Api-Key": data.apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json();
      available =
        response.ok &&
        body.success === true &&
        body.data?.ai?.chatCompletions?.available === true &&
        body.data?.ai?.usableModels?.includes(BITRIX_AGENT_MODEL) === true;
    } catch {
      /* Report a fixed message, never provider bodies or credentials. */
    }
    if (!available)
      throw new Error(
        "VibeCode hat den Zugang zu BitrixGPT 5.5 nicht bestätigt. Bitte Schlüssel und KI-Berechtigung prüfen.",
      );
    await ensureBookingAgentSchema(sql);
    await sql`update shop_settings set vibe_ai_api_key=${data.apiKey},updated_at=now() where shop_id='white-gloss'`;
    return { ok: true, overriddenByEnvironment: Boolean(process.env.VIBE_AI_API_KEY?.trim()) };
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
