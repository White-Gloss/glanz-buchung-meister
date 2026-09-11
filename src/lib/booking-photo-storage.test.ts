import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { saveBookingPhotos, cleanupFailedBookingPhotos } from "./booking-photo-storage.ts";

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
    (
      await pg.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        args,
      )
    ).rows) as Sql;
  sql.query = async <T>(q: string, args: unknown[] = []) => (await pg.query<T>(q, args)).rows;
  sql.transaction = transaction ?? ((fn) => fn(sql));
  return sql;
}
test("photo retries deduplicate, reservations cap concurrency, cleanup preserves ready files", async () => {
  const pg = new PGlite({ parsers: { 20: Number } });
  try {
    for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
      await pg.exec(await readFile(`migrations/${f}`, "utf8"));
    const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
    const [booking] = await sql<{
      id: number;
    }>`insert into bookings(customer_name,phone,package_id,class_id) values('Isolated test','00000000','basis','kompakt') returning id`;
    const file = (n: number) => ({
      name: `test-${n}.jpg`,
      mime: "image/jpeg",
      base64: Buffer.from([255, 216, 255, n]).toString("base64"),
    });
    const paths: string[] = [];
    const upload = async (path: string) => {
      paths.push(path);
    };
    await saveBookingPhotos(sql, booking.id, [file(1)], upload);
    await saveBookingPhotos(sql, booking.id, [file(1)], upload);
    assert.equal(paths.length, 1);
    await assert.rejects(
      saveBookingPhotos(sql, booking.id, [file(2)], async (path) => {
        paths.push(path);
        throw new Error("lost response");
      }),
      /lost response/,
    );
    await saveBookingPhotos(sql, booking.id, [file(2)], upload);
    assert.equal(paths[1], paths[2], "retry must reuse the durable object path");
    await assert.rejects(
      saveBookingPhotos(sql, booking.id, [file(3)], async () => {
        throw new Error("offline");
      }),
    );
    await sql`update booking_photos set updated_at=now()-interval '2 days' where upload_state='failed'`;
    const removed: string[] = [];
    assert.equal(
      await cleanupFailedBookingPhotos(sql, async (paths) => {
        removed.push(...paths);
      }),
      1,
    );
    assert.equal(removed.length, 1);
    assert.equal((await sql`select id from booking_photos where upload_state='ready'`).length, 2);
    const attempts = await Promise.allSettled(
      Array.from({ length: 7 }, (_, i) =>
        saveBookingPhotos(sql, booking.id, [file(i + 4)], upload),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 6);
    assert.equal((await sql`select id from booking_photos`).length, 8);
  } finally {
    await pg.close();
  }
});
