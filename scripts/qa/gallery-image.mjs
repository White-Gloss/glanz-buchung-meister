// Self-contained so Playwright can evaluate this against the actual <img>.
// A visible dialog/counter does not prove that its full-size image has loaded.
export async function decodedGalleryImage(image, expectedSrc) {
  const source = () => image.currentSrc || image.src;
  if (image.src !== expectedSrc) throw new Error("Gallery shows a different image than requested");
  let timer;
  try {
    await Promise.race([
      image.decode(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Gallery image decoding timed out")), 15000); }),
    ]);
    if (image.src !== expectedSrc || source() !== expectedSrc) throw new Error("Gallery decoded a different image than requested");
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error("Gallery image is not loaded");
    return { source: source(), width: image.naturalWidth, height: image.naturalHeight, decoded: true };
  } finally { clearTimeout(timer); }
}
