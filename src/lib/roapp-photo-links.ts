import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";
import { site } from "../data/site.ts";
import { createSignedPhotoUrl } from "./booking-photos.ts";
import { createOrderComment, type RoappRequest } from "./roapp.ts";

type Photo = { id: number; storage_path: string; original_name: string; created_at: string | Date };
const LINK_SECONDS = 90 * 24 * 60 * 60;

function linkSecret(): string {
  const secret = process.env.ROAPP_PHOTO_LINK_SECRET || process.env.BETTER_AUTH_SECRET || "";
  if (secret.length < 32) throw new Error("roapp_photo_secret_missing");
  return secret;
}

export function photoToken(
  photo: Pick<Photo, "id" | "storage_path">,
  expires: number,
  secret: string,
): string {
  const signature = createHmac("sha256", secret)
    .update(`ro-photo:v1:${photo.id}:${expires}:${photo.storage_path}`)
    .digest("hex");
  return `${photo.id}.${expires}.${signature}`;
}

export function verifyPhotoToken(
  token: string,
  photo: Pick<Photo, "id" | "storage_path">,
  secret: string,
  now = Date.now(),
): boolean {
  const match = /^([1-9]\d*)\.([1-9]\d{9})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[1]) !== photo.id || Number(match[2]) * 1000 <= now) return false;
  const expected = photoToken(photo, Number(match[2]), secret);
  return (
    token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  );
}

/** Only private storage objects are signed. Removing their metadata revokes access.
 * Bearer links are shared with the assigned RO order, never indexed or cached. */
export async function serveRoappPhoto(
  request: Request,
  sql: Sql,
  sign = createSignedPhotoUrl,
): Promise<Response> {
  const headers = {
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow, noarchive",
  };
  const token = new URL(request.url).searchParams.get("token") || "";
  const match = /^([1-9]\d{0,9})\.([1-9]\d{9})\.[a-f0-9]{64}$/.exec(token);
  if (!match || Number(match[1]) > 2147483647)
    return new Response("Nicht verfügbar", { status: 404, headers });
  const [photo] =
    await sql<Photo>`select p.id,p.storage_path,p.original_name,p.created_at from booking_photos p
    join roapp_sync_queue q on q.booking_id=p.booking_id and q.shop_id=p.shop_id
    where p.id=${Number(match[1])} and p.shop_id='white-gloss' and p.upload_state='ready' and q.ro_order_id is not null`;
  if (!photo || !verifyPhotoToken(token, photo, linkSecret()))
    return new Response("Nicht verfügbar", { status: 404, headers });
  return new Response(null, {
    status: 302,
    headers: { ...headers, location: await sign(photo.storage_path) },
  });
}

export async function syncRoappPhotos(
  sql: Sql,
  bookingId: number,
  orderId: number,
  request: RoappRequest,
) {
  const photos =
    await sql<Photo>`select id,storage_path,original_name,created_at from booking_photos
    where shop_id='white-gloss' and booking_id=${bookingId} and upload_state='ready' order by id`;
  for (const photo of photos) {
    const expires = Math.floor(new Date(photo.created_at).getTime() / 1000) + LINK_SECONDS;
    if (expires * 1000 <= Date.now()) continue;
    const token = photoToken(photo, expires, linkSecret());
    await createOrderComment(
      request,
      orderId,
      `Zustandsaufnahme zur Anfrage WG-${bookingId}: ${photo.original_name}\n${site.origin}/api/ro-photo?token=${token}\nVertraulicher Fotolink, 90 Tage ab Upload gültig. Fixpreis erst nach Begutachtung und manueller Freigabe.`,
    );
  }
}
