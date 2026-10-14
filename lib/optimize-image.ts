export async function optimizeWebsiteImage(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("Choose a JPEG, PNG, or WebP image under 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000)
      throw Error("Choose an image smaller than 40 megapixels.");
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Image processing unavailable.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Could not optimize image."))),
        "image/webp",
        0.82,
      ),
    );
    if (blob.size > 2 * 1024 * 1024)
      throw Error(
        "Optimized image is still too large; choose a smaller photo.",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
