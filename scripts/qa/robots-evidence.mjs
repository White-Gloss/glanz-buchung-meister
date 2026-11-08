// Extract only real head metadata from our SSR response, never arbitrary text
// such as serialized JavaScript containing the word "noindex".
export function robotsEvidence(html, headers) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(markup)?.[1] ?? "";
  const attribute = (tag, name) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(1).find((value) => value !== undefined) ?? "";
  const meta = [...head.matchAll(/<meta\b[^>]*>/gi)]
    .filter(([tag]) => attribute(tag, "name").toLowerCase() === "robots")
    .map(([tag]) => attribute(tag, "content").trim().toLowerCase());
  return { meta, header: headers.get("x-robots-tag") };
}
