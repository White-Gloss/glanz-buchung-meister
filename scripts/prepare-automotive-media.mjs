import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hash = (data) => createHash("sha256").update(data).digest("hex");

/** Fetch pinned build inputs, never third-party media from a visitor's browser. */
export async function prepareAutomotiveMedia({ root, assets, fetcher = fetch }) {
  const paths = new Set();
  for (const asset of assets) {
    if (!/^media\/(automotive-journey|scroll-film\/garage-journey)\/[a-z0-9-]+\.(webp|mp4)$/.test(asset.path)
      || paths.has(asset.path)
      || !/^https:\/\/d2ol7oe51mr4n9\.cloudfront\.net\/[a-zA-Z0-9_/-]+\.(webp|mp4)$/.test(asset.url)
      || !/^[a-f0-9]{64}$/.test(asset.sha256)
      || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > 25_000_000)
      throw new Error("Invalid automotive media manifest entry.");
    paths.add(asset.path);
  }
  for (const asset of assets) {
    const target = resolve(root, "public", asset.path);
    let cached;
    try { cached = await readFile(target); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (cached?.length === asset.bytes && hash(cached) === asset.sha256) continue;
    const response = await fetcher(asset.url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Automotive media download failed: ${asset.path} (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== asset.bytes || hash(bytes) !== asset.sha256)
      throw new Error(`Automotive media integrity mismatch: ${asset.path}`);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const { assets } = JSON.parse(await readFile(new URL("./automotive-media.json", import.meta.url), "utf8"));
  await prepareAutomotiveMedia({ root, assets });
  console.log(`Verified ${assets.length} automotive media assets for same-origin delivery.`);
}
