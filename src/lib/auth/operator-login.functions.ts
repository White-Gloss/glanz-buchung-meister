import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { googleNativeLoginEnabled } from "@/lib/auth/google-oauth";
import { isOperatorEmail } from "@/lib/operator";
import { getSql } from "@/lib/db";
import { assertPublicPostLimit } from "@/lib/rate-limit";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { auth } from "@/lib/auth/server";

export const googleLoginAvailable = createServerFn({ method: "GET" }).handler(async () => {
  const preview = process.env.NODE_ENV !== "production";
  return {
    google: preview || googleNativeLoginEnabled(),
    native: googleNativeLoginEnabled(),
  };
});

export const operatorBootstrapNeeded = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const sql = await getSql();
    const [row] = await sql<{ n: number }>`select count(*)::int as n from "user"`;
    return { needed: (row?.n ?? 0) === 0 };
  } catch {
    return { needed: false };
  }
});

export const bootstrapOperator = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(180),
        password: z.string().min(10).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    assertPublicPostLimit("operator-bootstrap", 5, 15 * 60 * 1000);
    if (!isOperatorEmail(data.email)) {
      throw new Error(
        "Nur eine Betriebs-E-Mail (@white-gloss.de) kann das erste Betriebskonto einrichten.",
      );
    }
    const sql = await getSql();
    const [row] = await sql<{ n: number }>`select count(*)::int as n from "user"`;
    if ((row?.n ?? 0) > 0) {
      throw new Error("Es gibt bereits ein Konto. Bitte anmelden.");
    }
    const result = await auth.api.signUpEmail({
      body: {
        email: data.email.toLowerCase(),
        password: data.password,
        name: "Betrieb",
      },
    });
    if (result && typeof result === "object" && "error" in result && result.error) {
      const err = result.error as { message?: string };
      throw new Error(err.message ?? "Betriebskonto konnte nicht eingerichtet werden.");
    }
    return { ok: true as const };
  });
