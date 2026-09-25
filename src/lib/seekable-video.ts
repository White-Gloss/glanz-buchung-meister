/** Nitro's static transport does not provide byte ranges. A local blob makes
 * the original short film seekable without depending on server Range support.
 * Called only after interaction; cleanup aborts downloads and releases memory.
 */
export function loadSeekableVideo(
  video: Pick<HTMLVideoElement, "src" | "load">,
  source: string,
  onError: () => void,
) {
  const controller = new AbortController();
  let objectUrl: string | undefined;
  void fetch(source, { signal: controller.signal, credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Video unavailable");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
      video.load();
    })
    .catch(() => {
      if (!controller.signal.aborted) onError();
    });
  return () => {
    controller.abort();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}
