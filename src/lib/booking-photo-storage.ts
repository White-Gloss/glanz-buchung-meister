import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "./db.ts";
import {
  decodeUploadBase64,
  validateUploadBatch,
  uploadToConditionPhotos,
  deleteConditionPhotos,
} from "./booking-photos.ts";
import { MAX_UPLOAD_FILES } from "./upload-policy.ts";

const SHOP = "white-gloss";
type Photo = { id: number; storage_path: string; upload_state: string; busy: boolean };

export async function saveBookingPhotos(
  sql: Sql,
  bookingId: number,
  files: { name: string; mime: string; base64: string }[],
  upload = uploadToConditionPhotos,
) {
  const validated = validateUploadBatch(files);
  let count = 0;
  for (const [index, file] of files.entries()) {
    const bytes = decodeUploadBase64(file.base64);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const token = randomBytes(16).toString("hex");
    const photo = await sql.transaction(async (tx) => {
      const locked =
        await tx`select id from bookings where shop_id=${SHOP} and id=${bookingId} for update`;
      if (!locked.length) throw new Error("Buchung nicht gefunden.");
      const [existing] =
        await tx<Photo>`select id,storage_path,upload_state,coalesce(upload_until>now(),false) as busy
        from booking_photos where shop_id=${SHOP} and booking_id=${bookingId} and content_hash=${hash}`;
      if (existing?.upload_state === "ready") return existing;
      if (existing?.busy)
        throw new Error(
          "Diese Aufnahme wird noch übertragen. Bitte kurz warten und erneut versuchen.",
        );
      if (existing) {
        await tx`update booking_photos set upload_state='pending',upload_lease=${token},upload_until=now()+interval '90 seconds',updated_at=now() where id=${existing.id}`;
        return existing;
      }
      const [total] = await tx<{
        count: number;
      }>`select count(*)::integer as count from booking_photos where shop_id=${SHOP} and booking_id=${bookingId}`;
      if (total.count >= MAX_UPLOAD_FILES)
        throw new Error(
          "Zu diesem Vorgang sind bereits acht Aufnahmen hinterlegt oder reserviert.",
        );
      const path = `bookings/${bookingId}/${randomBytes(16).toString("hex")}.${validated[index].ext}`;
      const [created] =
        await tx<Photo>`insert into booking_photos(shop_id,booking_id,storage_path,mime,size_bytes,original_name,content_hash,upload_state,upload_lease,upload_until)
        values(${SHOP},${bookingId},${path},${validated[index].mime},${bytes.length},${file.name},${hash},'pending',${token},now()+interval '90 seconds') returning id,storage_path,upload_state`;
      return created;
    });
    if (photo.upload_state !== "ready") {
      try {
        await upload(photo.storage_path, bytes, validated[index].mime);
        const saved =
          await sql`update booking_photos set upload_state='ready',upload_lease=null,upload_until=null,updated_at=now()
          where id=${photo.id} and shop_id=${SHOP} and upload_lease=${token} returning id`;
        if (!saved.length)
          throw new Error("Upload konnte nicht sicher zugeordnet werden. Bitte erneut versuchen.");
      } catch (error) {
        // Keep the exact object path durably registered, including lost responses.
        await sql`update booking_photos set upload_state='failed',upload_until=null,upload_lease=null,updated_at=now()
          where id=${photo.id} and shop_id=${SHOP} and upload_lease=${token}`;
        throw error;
      }
    }
    count++;
  }
  return { ok: true as const, count };
}

/** Only unsuccessful reservations expire; never removes a completed customer upload. */
export async function cleanupFailedBookingPhotos(sql: Sql, remove = deleteConditionPhotos) {
  return sql.transaction(async (tx) => {
    const rows = await tx<{
      id: number;
      storage_path: string;
    }>`select id,storage_path from booking_photos
      where shop_id=${SHOP} and upload_state<>'ready' and updated_at<now()-interval '24 hours'
      and (upload_until is null or upload_until<now()) order by id for update skip locked limit 8`;
    if (!rows.length) return 0;
    await remove(rows.map((row) => row.storage_path));
    await tx`delete from booking_photos where shop_id=${SHOP} and id=any(${rows.map((row) => row.id)}::integer[])`;
    return rows.length;
  });
}
