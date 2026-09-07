/** CMS timestamps arrive as pg Date objects or serialized strings. */
export function cmsPublishedDate(value: Date | string | null | undefined): string | undefined {
  if (value == null || (typeof value === "string" && !value.trim())) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
}
