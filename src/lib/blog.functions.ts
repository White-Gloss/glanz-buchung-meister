import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSupabasePublishableFetch } from "@/integrations/supabase/publishable-key-fetch";
import type { Database } from "@/integrations/supabase/types";
import type { FaqRow } from "./faqs.functions";

/**
 * RATGEBER-BEITRÄGE
 * ------------------
 * Beitragstexte liegen als Markdown in der Datenbank, Bilder im
 * öffentlichen Storage-Bucket "blog-images" (jeder darf lesen, nur Admins
 * dürfen schreiben — siehe Migration).
 *
 * Zu jedem Beitrag lassen sich beliebig viele FAQs zuordnen
 * (Verknüpfungstabelle blog_faqs). Die Website rendert daraus einen
 * FAQ-Abschnitt unter dem Artikel und eine FAQPage-Auszeichnung.
 */

export const BLOG_IMAGE_BUCKET = "blog-images";

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  featured_image_url: string | null;
  author: string;
  published_at: string | null;
  meta_title: string;
  meta_description: string;
  og_image_url: string | null;
  focus_keywords: string[];
  created_at: string;
  updated_at: string;
};

/** Übersichtsseite braucht den vollen Artikeltext nicht. */
export type BlogPostSummary = Omit<BlogPostRow, "content">;

/** Ein Beitrag samt der ihm zugeordneten FAQs. */
export type BlogPostWithFaqs = BlogPostRow & { faqs: FaqRow[] };

const POST_COLUMNS =
  "id, slug, title, content, excerpt, featured_image_url, author, published_at, meta_title, meta_description, og_image_url, focus_keywords, created_at, updated_at";

const SUMMARY_COLUMNS =
  "id, slug, title, excerpt, featured_image_url, author, published_at, meta_title, meta_description, og_image_url, focus_keywords, created_at, updated_at";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Öffentliche URL zu einem Bild im Bucket — reine URL-Bildung, kein
 * Netzwerkaufruf nötig (identisch zur Galerie).
 */
export function blogImagePublicUrl(storagePath: string): string {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);
  if (!url) return "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${BLOG_IMAGE_BUCKET}/${storagePath}`;
}

/**
 * Umkehrung von blogImagePublicUrl: liefert den Storage-Pfad, wenn die URL
 * auf unseren eigenen Bucket zeigt — sonst null (z. B. bei einem extern
 * gehosteten Bild, das wir nicht löschen dürfen).
 */
function storagePathFromPublicUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const marker = `/storage/v1/object/public/${BLOG_IMAGE_BUCKET}/`;
  const index = imageUrl.indexOf(marker);
  if (index === -1) return null;
  const path = imageUrl.slice(index + marker.length).split("?")[0];
  return path || null;
}

function normalizeText(value: string, label: string, maxLength: number, required = false): string {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw new Error(`${label} ist ein Pflichtfeld.`);
  if (normalized.length > maxLength) {
    throw new Error(`${label} darf höchstens ${maxLength} Zeichen enthalten.`);
  }
  return normalized;
}

/**
 * Bild-URLs müssen https sein. Ein `javascript:`-Wert landete sonst
 * ungeprüft im src-Attribut bzw. im og:image-Tag.
 */
function normalizeImageUrl(value: string | null, label: string): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (!normalized.startsWith("https://")) {
    throw new Error(`${label} muss eine vollständige https-Adresse sein.`);
  }
  if (normalized.length > 800) throw new Error(`${label} ist zu lang.`);
  return normalized;
}

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

/** Anonymer Client für öffentliche Leseabfragen (RLS filtert Entwürfe weg). */
async function createPublicClient(): Promise<SupabaseClient<Database> | null> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createSupabasePublishableFetch(key) },
  });
}

// =====================================================================
// Öffentliche Abfragen (Website)
// =====================================================================

/**
 * Veröffentlichte Beiträge, neueste zuerst.
 *
 * Der Zeitfilter steht zusätzlich zur RLS-Policy hier im Code, damit ein
 * vorgeplanter Beitrag (published_at in der Zukunft) auch dann nicht
 * erscheint, wenn die Abfrage einmal mit erweiterten Rechten läuft.
 */
export const listPublishedBlogPosts = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlogPostSummary[]> => {
    const client = await createPublicClient();
    if (!client) return [];

    const { data, error } = await client
      .from("blog_posts")
      .select(SUMMARY_COLUMNS)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    if (error) return [];
    return data ?? [];
  },
);

/**
 * Ein einzelner veröffentlichter Beitrag inkl. zugeordneter FAQs.
 * Gibt null zurück, wenn es den Slug nicht gibt — die Route wirft daraus
 * ein sauberes 404 statt einer Fehlerseite.
 */
export const getPublishedBlogPost = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<BlogPostWithFaqs | null> => {
    const slug = String(data.slug ?? "")
      .trim()
      .toLowerCase();
    if (!SLUG_PATTERN.test(slug)) return null;

    const client = await createPublicClient();
    if (!client) return null;

    const { data: post, error } = await client
      .from("blog_posts")
      .select(POST_COLUMNS)
      .eq("slug", slug)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    if (error || !post) return null;

    // Zugeordnete FAQs über die Verknüpfungstabelle. Unveröffentlichte
    // FAQs filtert bereits die RLS-Policy der faqs-Tabelle heraus; der
    // Join liefert dafür dann null, was unten wegfällt.
    const { data: links } = await client
      .from("blog_faqs")
      .select(
        "sort_order, faqs (id, question, answer, category, sort_order, is_published, created_at)",
      )
      .eq("blog_post_id", post.id)
      .order("sort_order");

    const faqs = (links ?? [])
      .map((link) => link.faqs as FaqRow | null)
      .filter((faq): faq is FaqRow => Boolean(faq) && faq!.is_published);

    return { ...post, faqs };
  });

// =====================================================================
// Admin-Abfragen
// =====================================================================

/** Alle Beiträge inkl. Entwürfe — nur Admin. */
export const listAllBlogPosts = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<BlogPostSummary[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("blog_posts")
      .select(SUMMARY_COLUMNS)
      .order("published_at", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Ein Beitrag zum Bearbeiten, inkl. der IDs der zugeordneten FAQs. */
export const getBlogPostForEdit = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<(BlogPostRow & { faqIds: string[] }) | null> => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Beitrags-ID.");

    const { data: post, error } = await context.supabase
      .from("blog_posts")
      .select(POST_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) return null;

    const { data: links, error: linkError } = await context.supabase
      .from("blog_faqs")
      .select("faq_id, sort_order")
      .eq("blog_post_id", post.id)
      .order("sort_order");
    if (linkError) throw new Error(linkError.message);

    return { ...post, faqIds: (links ?? []).map((link) => link.faq_id) };
  });

export type BlogPostInput = {
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  featuredImageUrl: string | null;
  author: string;
  /** ISO-Zeitstempel oder null für „Entwurf". */
  publishedAt: string | null;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
  focusKeywords: string[];
  /** IDs der zugeordneten FAQs, in der gewünschten Reihenfolge. */
  faqIds: string[];
};

function normalizeBlogPostInput(data: BlogPostInput) {
  const slug = String(data.slug ?? "")
    .trim()
    .toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 80) {
    throw new Error(
      "Die URL-Kurzform darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten (3–80 Zeichen).",
    );
  }

  let publishedAt: string | null = null;
  if (data.publishedAt) {
    const parsed = new Date(data.publishedAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Das Veröffentlichungsdatum ist ungültig.");
    }
    publishedAt = parsed.toISOString();
  }

  const focusKeywords = [
    ...new Set(
      (Array.isArray(data.focusKeywords) ? data.focusKeywords : [])
        .map((keyword) => normalizeText(keyword, "Fokus-Keyword", 80))
        .filter(Boolean),
    ),
  ];
  if (focusKeywords.length > 10) {
    throw new Error("Es sind höchstens zehn Fokus-Keywords möglich.");
  }

  const faqIds = [...new Set(Array.isArray(data.faqIds) ? data.faqIds : [])];
  if (faqIds.some((id) => !UUID_PATTERN.test(id))) {
    throw new Error("Mindestens eine zugeordnete FAQ ist ungültig.");
  }
  if (faqIds.length > 50) throw new Error("Es sind höchstens 50 FAQs je Beitrag möglich.");

  return {
    row: {
      slug,
      title: normalizeText(data.title, "Titel", 160, true),
      content: normalizeText(data.content, "Inhalt", 60_000),
      excerpt: normalizeText(data.excerpt, "Kurzfassung", 320),
      featured_image_url: normalizeImageUrl(data.featuredImageUrl, "Das Beitragsbild"),
      author: normalizeText(data.author, "Autor", 120) || "White Gloss Detailing",
      published_at: publishedAt,
      // 70 bzw. 180 Zeichen: darüber kürzt Google das Snippet sichtbar ab.
      meta_title: normalizeText(data.metaTitle, "Meta-Titel", 70),
      meta_description: normalizeText(data.metaDescription, "Meta-Beschreibung", 180),
      og_image_url: normalizeImageUrl(data.ogImageUrl, "Das Open-Graph-Bild"),
      focus_keywords: focusKeywords,
    },
    faqIds,
  };
}

/**
 * Setzt die FAQ-Zuordnungen eines Beitrags neu.
 *
 * Bewusst „alles löschen, dann neu schreiben": die Zuordnungsliste ist
 * kurz, und so entsteht garantiert genau der Zustand, den das Formular
 * anzeigt — ohne Sonderfälle für hinzugefügte/entfernte Einträge.
 */
async function replaceFaqLinks(
  supabase: SupabaseClient<Database>,
  blogPostId: string,
  faqIds: string[],
) {
  const { error: deleteError } = await supabase
    .from("blog_faqs")
    .delete()
    .eq("blog_post_id", blogPostId);
  if (deleteError) throw new Error(deleteError.message);

  if (faqIds.length === 0) return;

  const { error: insertError } = await supabase.from("blog_faqs").insert(
    faqIds.map((faqId, index) => ({
      blog_post_id: blogPostId,
      faq_id: faqId,
      sort_order: index,
    })),
  );
  if (insertError) {
    if (insertError.code === "23503") {
      throw new Error("Mindestens eine zugeordnete FAQ existiert nicht mehr.");
    }
    throw new Error(insertError.message);
  }
}

export const createBlogPost = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: BlogPostInput) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { row, faqIds } = normalizeBlogPostInput(data);

    const { data: created, error } = await context.supabase
      .from("blog_posts")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        throw new Error(`Die URL-Kurzform „${row.slug}“ ist bereits vergeben.`);
      }
      throw new Error(error.message);
    }
    if (!created) throw new Error("Der Beitrag konnte nicht angelegt werden.");

    await replaceFaqLinks(context.supabase, created.id, faqIds);
    return { ok: true, id: created.id };
  });

export const updateBlogPost = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string } & BlogPostInput) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Beitrags-ID.");
    const { row, faqIds } = normalizeBlogPostInput(data);

    const { data: updated, error } = await context.supabase
      .from("blog_posts")
      .update(row)
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        throw new Error(`Die URL-Kurzform „${row.slug}“ ist bereits vergeben.`);
      }
      throw new Error(error.message);
    }
    if (!updated) throw new Error("Der Beitrag wurde nicht gefunden oder bereits gelöscht.");

    await replaceFaqLinks(context.supabase, updated.id, faqIds);
    return { ok: true };
  });

/**
 * Beitrag löschen. Die Verknüpfungen verschwinden per ON DELETE CASCADE;
 * das Beitragsbild wird zusätzlich aus dem Storage entfernt, sofern es
 * in unserem eigenen Bucket liegt.
 */
export const deleteBlogPost = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Beitrags-ID.");

    // Bildpfade serverseitig lesen, damit ein manipulierter Aufruf nicht
    // die Datei eines fremden Beitrags mitlöschen kann.
    const { data: post, error: readError } = await context.supabase
      .from("blog_posts")
      .select("featured_image_url, og_image_url")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!post) throw new Error("Der Beitrag wurde nicht gefunden oder bereits gelöscht.");

    const { data: deleted, error } = await context.supabase
      .from("blog_posts")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Der Beitrag wurde nicht gefunden oder bereits gelöscht.");

    const paths = [
      storagePathFromPublicUrl(post.featured_image_url),
      storagePathFromPublicUrl(post.og_image_url),
    ].filter((path): path is string => Boolean(path));

    let storageWarning: string | null = null;
    if (paths.length > 0) {
      const { error: storageError } = await context.supabase.storage
        .from(BLOG_IMAGE_BUCKET)
        .remove([...new Set(paths)]);
      storageWarning = storageError?.message ?? null;
    }

    return { ok: true, storageWarning };
  });

function hasValidImageSignature(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    contentType === "image/webp" &&
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

/**
 * Liest die Bildmaße direkt aus dem Dateikopf.
 *
 * Hintergrund: Ohne width/height am <img> reserviert der Browser keinen
 * Platz und das Layout springt beim Nachladen (Cumulative Layout Shift).
 * Die Maße hier einmal beim Upload zu ermitteln ist billiger als sie
 * später im Browser zu messen — sie werden als Query-Parameter an die
 * öffentliche URL gehängt (…?w=1600&h=900) und beim Rendern wieder
 * ausgelesen. Supabase ignoriert unbekannte Query-Parameter.
 */
function readImageDimensions(
  bytes: Buffer,
  contentType: string,
): { width: number; height: number } | null {
  try {
    if (contentType === "image/png") {
      // IHDR ist immer der erste Chunk: Breite/Höhe stehen ab Byte 16.
      if (bytes.length < 24) return null;
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }

    if (contentType === "image/jpeg") {
      // Segmentkette ab Byte 2 durchlaufen, bis ein SOF-Marker kommt.
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1];
        const length = bytes.readUInt16BE(offset + 2);

        // SOF0–SOF15 tragen die Maße; DHT/DAC/RST sind gleich kodiert,
        // aber keine Rahmenkopf-Segmente und werden übersprungen.
        const isStartOfFrame =
          marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isStartOfFrame) {
          return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
      return null;
    }

    if (contentType === "image/webp" && bytes.length >= 30) {
      const chunk = bytes.subarray(12, 16).toString("ascii");
      if (chunk === "VP8X") {
        // Erweitertes Format: je 24 Bit für Breite-1 und Höhe-1.
        return {
          width: bytes.readUIntLE(24, 3) + 1,
          height: bytes.readUIntLE(27, 3) + 1,
        };
      }
      if (chunk === "VP8 ") {
        // Verlustbehaftet: nach der 3-Byte-Startsequenz je 14 Bit.
        return {
          width: bytes.readUInt16LE(26) & 0x3fff,
          height: bytes.readUInt16LE(28) & 0x3fff,
        };
      }
      if (chunk === "VP8L") {
        // Verlustfrei: 14 Bit Breite-1, danach 14 Bit Höhe-1, bitweise gepackt.
        const bits = bytes.readUInt32LE(21);
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1,
        };
      }
    }
  } catch {
    // Unerwarteter Dateiaufbau: lieber ohne Maße weitermachen, als den
    // Upload scheitern zu lassen. Das Rendern fällt dann auf 16:9 zurück.
  }
  return null;
}

/**
 * Beitragsbild hochladen und die öffentliche URL zurückgeben.
 *
 * Die Datei kommt als Base64 an, weil TanStack-Server-Functions JSON
 * übertragen (gleiches Verfahren wie bei der Galerie). Die Prüfung der
 * Dateisignatur verhindert, dass eine als Bild deklarierte Datei anderen
 * Inhalt trägt; das 8-MB-Limit gilt zusätzlich im Bucket selbst.
 */
export const uploadBlogImage = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { fileName: string; contentType: string; base64Data: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    if (!ALLOWED_IMAGE_TYPES.has(data.contentType)) {
      throw new Error("Nur JPEG, PNG oder WebP werden unterstützt.");
    }
    if (!data.base64Data || data.base64Data.length > MAX_BASE64_LENGTH) {
      throw new Error("Datei ist leer oder größer als 8 MB.");
    }

    const bytes = Buffer.from(data.base64Data, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Datei ist größer als 8 MB.");
    }
    if (!hasValidImageSignature(bytes, data.contentType)) {
      throw new Error("Die Datei stimmt nicht mit dem angegebenen Bildformat überein.");
    }

    const ext = data.fileName.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const path = `${context.userId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${safeExt}`;

    const { error: uploadError } = await context.supabase.storage
      .from(BLOG_IMAGE_BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    // Maße an die URL hängen, damit das <img> später width/height setzen
    // kann, ohne dass eine zusätzliche Spalte nötig wäre.
    const dimensions = readImageDimensions(bytes, data.contentType);
    const baseUrl = blogImagePublicUrl(path);
    const publicUrl = dimensions
      ? `${baseUrl}?w=${dimensions.width}&h=${dimensions.height}`
      : baseUrl;

    return {
      ok: true,
      path,
      publicUrl,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };
  });
