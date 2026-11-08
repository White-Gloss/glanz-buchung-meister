import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { lstat, mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { isStudioMediaId, STUDIO_IMAGE_MAX_BYTES } from "./studio-media.model.ts";

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
  const fromApplication = relative(resolve(applicationRoot), root);
  if (
    !fromApplication ||
    (!fromApplication.startsWith(`..${sep}`) &&
      fromApplication !== ".." &&
      !isAbsolute(fromApplication))
  ) {
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
  const checkRealLocation = async () => {
    const actual = await realpath(root);
    const actualApp = await realpath(applicationRoot).catch(() => resolve(applicationRoot));
    studioMediaDirectory(actual, actualApp);
  };
  return {
    async put(id: string, data: Uint8Array): Promise<void> {
      const path = filePath(id);
      if (!data.byteLength || data.byteLength > STUDIO_IMAGE_MAX_BYTES)
        throw new Error("Ungültige Bildgröße.");
      await mkdir(root, { recursive: true, mode: 0o700 });
      await checkRealLocation();
      await writeFile(path, data, { flag: "wx", mode: 0o600 });
    },
    async read(id: string): Promise<Buffer | null> {
      const path = filePath(id);
      try {
        await checkRealLocation();
        const stat = await lstat(path);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > STUDIO_IMAGE_MAX_BYTES)
          return null;
        return await readFile(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async remove(id: string): Promise<void> {
      const path = filePath(id);
      await checkRealLocation();
      await unlink(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    },
  };
}
