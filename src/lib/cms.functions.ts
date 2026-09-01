import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { getSql } from "@/lib/db";

const SHOP = "white-gloss";

export type CmsKind = "faq" | "blog" | "gallery" | "service";

export type CmsRow = {
  id: number;
  kind: string;
  slug: string | null;
  title: string;
  body: string;
  extra: string;
  published: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
};

const kindSchema = z.enum(["faq", "blog", "gallery", "service"]);

export const listCms = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ kind: kindSchema }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<CmsRow>`
      select id, kind, slug, title, body, extra, published, sort, created_at, updated_at
      from cms_items
      where shop_id = ${SHOP} and kind = ${data.kind}
      order by sort asc, id desc
    `;
  });

export const listPublishedCms = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ kind: kindSchema }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<CmsRow>`
      select id, kind, slug, title, body, extra, published, sort, created_at, updated_at
      from cms_items
      where shop_id = ${SHOP} and kind = ${data.kind} and published = true
      order by sort asc, id desc
    `;
  });

export const upsertCms = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        id: z.number().int().positive().optional(),
        kind: kindSchema,
        slug: z.string().max(80).optional(),
        title: z.string().trim().min(2).max(200),
        body: z.string().max(20000),
        extra: z.string().max(4000).optional(),
        published: z.boolean().optional(),
        sort: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const extra = data.extra ?? "{}";
    const published = data.published ?? true;
    const sort = data.sort ?? 0;
    const slug = data.slug || null;
    if (data.id) {
      await sql`
        update cms_items
        set title = ${data.title}, body = ${data.body}, extra = ${extra},
            published = ${published}, sort = ${sort}, slug = ${slug}, updated_at = now()
        where id = ${data.id} and shop_id = ${SHOP}
      `;
      return { id: data.id };
    }
    const rows = await sql<{ id: number }>`
      insert into cms_items (shop_id, kind, slug, title, body, extra, published, sort)
      values (${SHOP}, ${data.kind}, ${slug}, ${data.title}, ${data.body}, ${extra}, ${published}, ${sort})
      returning id
    `;
    return { id: rows[0]?.id };
  });

export const deleteCms = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from cms_items where id = ${data.id} and shop_id = ${SHOP}`;
    return { ok: true as const };
  });
