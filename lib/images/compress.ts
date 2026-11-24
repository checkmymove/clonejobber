/**
 * Browser-side photo shrinking for request uploads. A request is saved in one call and
 * Vercel caps a call at 4.5 MB, so phone photos (often 4–12 MB each) are re-encoded as
 * JPEG and scaled down until all of them fit the given budget. Client only.
 */

const MAX_SIDE = 2400;
const MIN_SIDE = 900;

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function encode(file: File, maxBytes: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    let side = Math.min(MAX_SIDE, Math.max(bitmap.width, bitmap.height));
    let quality = 0.85;
    for (let attempt = 0; attempt < 12; attempt++) {
      const scale = side / Math.max(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.fillStyle = "#ffffff"; // PNG transparency becomes white, not black.
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob(canvas, quality);
      if (!blob) return file;
      if (blob.size <= maxBytes || (side <= MIN_SIDE && quality <= 0.5)) {
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
      }
      if (quality > 0.6) quality -= 0.1;
      else side = Math.max(MIN_SIDE, Math.round(side * 0.8));
    }
    return file;
  } finally {
    bitmap.close();
  }
}

/** Shrinks each image so that together they stay under `totalBudget` bytes. */
export async function compressImages(files: File[], totalBudget: number): Promise<File[]> {
  if (files.length === 0) return files;
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total <= totalBudget) return files;
  const perFile = Math.floor(totalBudget / files.length);
  return Promise.all(
    files.map(async (file) => {
      if (file.size <= perFile) return file;
      try {
        return await encode(file, perFile);
      } catch {
        return file; // A format the browser can't decode: the server check decides.
      }
    }),
  );
}
