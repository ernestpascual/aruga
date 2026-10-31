"use client";

/** Max edge for chat photos (free-tier friendly). ~100–250KB per JPEG. */
const MAX_DIM = 1280;
const JPEG_QUALITY = 0.72;
const MAX_BYTES = 900 * 1024; // target <900KB after compress

export async function compressImageFile(file: File): Promise<{ file: File; previewUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);

  // try quality steps to stay under MAX_BYTES
  let quality = JPEG_QUALITY;
  let blob: Blob | null = null;
  for (let i = 0; i < 3; i++) {
    blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) break;
    if (blob.size <= MAX_BYTES || quality <= 0.5) break;
    quality -= 0.12;
  }
  if (!blob) throw new Error("Compression failed");

  const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  const previewUrl = URL.createObjectURL(compressedFile);
  bitmap.close();
  return { file: compressedFile, previewUrl, width: w, height: h };
}

export function isImageFile(f: File) {
  return /^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(f.type);
}
