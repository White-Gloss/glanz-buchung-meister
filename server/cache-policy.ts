export const IMMUTABLE_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";
export const DISCOVERY_CACHE_CONTROL = "public, max-age=86400";

/** Only Vite's content-hashed build output can safely outlive a deployment. */
export function responseCacheControl({
  pathname,
  contentType = "",
  existing = "",
  method = "GET",
  status = 200,
  hasSetCookie = false,
}: {
  pathname: string;
  contentType?: string;
  existing?: string;
  method?: string;
  status?: number;
  hasSetCookie?: boolean;
}): string | undefined {
  if (/(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|=|,|$)/i.test(existing)) {
    return undefined;
  }
  if (hasSetCookie) return "private, no-store";
  if (!/^(?:GET|HEAD)$/i.test(method) || status < 200 || status >= 300) return undefined;
  if (contentType.includes("text/html")) return REVALIDATE_CACHE_CONTROL;
  if (
    /^\/assets\/.+-[\w-]{8,}\.(?:js|css|avif|webp|woff2?|png|jpe?g|svg|webm|mp4|ico|gif)$/i.test(
      pathname,
    )
  ) {
    return IMMUTABLE_ASSET_CACHE_CONTROL;
  }
  if (/\.(?:avif|webp|woff2?|png|jpe?g|svg|js|css|webm|mp4|ico|gif|webmanifest)$/i.test(pathname)) {
    return REVALIDATE_CACHE_CONTROL;
  }
  if (/\.(?:xml|txt)$/i.test(pathname)) return DISCOVERY_CACHE_CONTROL;
  return undefined;
}
