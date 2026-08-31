import { createServerFn } from "@tanstack/react-start";
import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { authMiddleware } from "@/lib/auth/middleware";

const exec = promisify(execFile);
const DIR = process.env.VERCEL ? "/tmp/white-gloss-backups" : "/workspace/backups";
const FILE = "white-gloss-sicherung.tgz";
const PATH = `${DIR}/${FILE}`;

async function meta() {
  try {
    const s = await stat(PATH);
    return { exists: true as const, bytes: s.size, at: s.mtime.toISOString() };
  } catch {
    return { exists: false as const, bytes: 0, at: null as string | null };
  }
}

export const getSiteBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => meta());

export const createSiteBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    await mkdir(DIR, { recursive: true });
    await exec("tar", [
      "-czf",
      PATH,
      "-C",
      "/workspace",
      "--exclude=node_modules",
      "--exclude=.vercel",
      "--exclude=backups",
      "src",
      "public",
      "package.json",
    ]);
    return meta();
  });

export const restoreSiteBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const current = await meta();
    if (!current.exists) {
      throw new Error("Keine Sicherung vorhanden.");
    }
    await exec("tar", ["-xzf", PATH, "-C", "/workspace"]);
    return current;
  });
