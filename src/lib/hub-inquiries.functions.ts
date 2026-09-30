import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { listHubInquiries } from "@/lib/hub-inquiries";
import { requireOperator } from "@/lib/operator";

export const listOpenWebsiteInquiries = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireOperator(context.userId);
    const sql = await getSql();
    return { inquiries: await listHubInquiries(sql) };
  });
