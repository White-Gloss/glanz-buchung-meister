import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { constants, type Stats } from "node:fs";
import { lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { isStudioMediaId, STUDIO_IMAGE_MAX_BYTES } from "./studio-media.model.ts";

// The complete release/staging trees must stay disposable. Common webroots are
// never private storage, even when they are outside the currently running cwd.
const excludedMediaRoots = [
  "/srv/white-gloss-releases",
  "/srv/white-gloss-current",
  "/var/lib/white-gloss-deploy",
  "/var/www",
  "/srv/www",
  "/srv/http",
  "/usr/share/nginx/html",
  "/usr/share/caddy",
];

function containsPath(parent: string, child: string) {
  const within = relative(parent, child);
  return !within || (!within.startsWith(`..${sep}`) && within !== ".." && !isAbsolute(within));
}

export function studioMediaDirectory(
  directory: string | undefined,
  applicationRoot = process.cwd(),
) {
  if (!directory?.trim())
    throw new Error(
      "CMS_MEDIA_DIR fehlt. Der private Bildspeicher muss zuerst eingerichtet werden.",
    );
  if (!isAbsolute(directory)) throw new Error("CMS_MEDIA_DIR muss ein absoluter Pfad sein.");
  const root = resolve(directory);
  const excluded = [resolve(applicationRoot), ...excludedMediaRoots];
  if (excluded.some((path) => containsPath(path, root) || containsPath(root, path))) {
    throw new Error(
      "Der Bildspeicher muss außerhalb des Website- und Veröffentlichungsverzeichnisses liegen.",
    );
  }
  return root;
}

export function createStudioMediaStore(directory: string, applicationRoot = process.cwd()) {
  const root = studioMediaDirectory(directory, applicationRoot);
  const filePath = (id: string) => {
    if (!isStudioMediaId(id)) throw new Error("Ungültige Bildkennung.");
    return join(root, `${id}.webp`);
  };
  // Check before mkdir too: a symlink in a parent must not create a directory in
  // its target before the later realpath check rejects it.
  const checkDirectoryLinks = async () => {
    let cursor = resolve(sep);
    for (const component of root.split(sep).filter(Boolean)) {
      cursor = join(cursor, component);
      try {
        if ((await lstat(cursor)).isSymbolicLink())
          throw new Error("Der private Bildspeicher darf keine Symlinks enthalten.");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
    }
  };
  const checkRealLocation = async () => {
    await checkDirectoryLinks();
    const actual = await realpath(root);
    const actualApp = await realpath(applicationRoot).catch(() => resolve(applicationRoot));
    studioMediaDirectory(actual, actualApp);
    const actualExcluded = await Promise.all(
      excludedMediaRoots.map((path) =>
        realpath(path).catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return path;
          throw new Error("Die Ausschlussverzeichnisse des Bildspeichers sind nicht prüfbar.");
        }),
      ),
    );
    if (actualExcluded.some((path) => containsPath(path, actual) || containsPath(actual, path)))
      throw new Error(
        "Der Bildspeicher muss außerhalb des Website- und Veröffentlichungsverzeichnisses liegen.",
      );
    if (actual !== root) throw new Error("Der private Bildspeicher darf keine Symlinks enthalten.");
    const stat = await lstat(root);
    if (
      !stat.isDirectory() ||
      (stat.mode & 0o7777) !== 0o700 ||
      (process.getuid && stat.uid !== process.getuid())
    )
      throw new Error(
        "Der private Bildspeicher benötigt 0700 und den Dienstnutzer als Eigentümer.",
      );
  };
  const privateFile = (stat: Stats) =>
    stat.isFile() &&
    !stat.isSymbolicLink() &&
    stat.nlink === 1 &&
    (stat.mode & 0o7777) === 0o600 &&
    (!process.getuid || stat.uid === process.getuid());
  return {
    async put(id: string, data: Uint8Array): Promise<void> {
      const path = filePath(id);
      if (!data.byteLength || data.byteLength > STUDIO_IMAGE_MAX_BYTES)
        throw new Error("Ungültige Bildgröße.");
      await checkDirectoryLinks();
      await mkdir(root, { recursive: true, mode: 0o700 });
      await checkRealLocation();
      const file = await open(path, "wx", 0o600);
      try {
        if (!privateFile(await file.stat()))
          throw new Error(
            "Private Bilddateien benötigen 0600 und den Dienstnutzer als Eigentümer.",
          );
        await file.writeFile(data);
      } finally {
        await file.close();
      }
    },
    async read(id: string): Promise<Buffer | null> {
      const path = filePath(id);
      try {
        await checkRealLocation();
        const stat = await lstat(path);
        if (!privateFile(stat) || !stat.size || stat.size > STUDIO_IMAGE_MAX_BYTES) return null;
        // Verify the opened inode as well; do not follow a replacement symlink
        // between lstat and open, or return bytes from a newly permissive file.
        const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const opened = await file.stat();
          if (!privateFile(opened) || !opened.size || opened.size > STUDIO_IMAGE_MAX_BYTES)
            return null;
          return await file.readFile();
        } finally {
          await file.close();
        }
      } catch (error) {
        if (["ENOENT", "ELOOP"].includes((error as NodeJS.ErrnoException).code ?? "")) return null;
        throw error;
      }
    },
    async remove(id: string): Promise<void> {
      const path = filePath(id);
      await checkRealLocation();
      try {
        if (!privateFile(await lstat(path)))
          throw new Error(
            "Private Bilddateien benötigen 0600 und den Dienstnutzer als Eigentümer.",
          );
        await unlink(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}
