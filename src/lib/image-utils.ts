/**
 * Shared image compression utilities for Warsha.
 * Uses HTML5 Canvas to resize and convert images to WebP before upload.
 */

export interface CompressOptions {
  maxWidth?: number;
  quality?: number;
  format?: "image/webp" | "image/jpeg";
}

/**
 * Compress an image file using HTML5 Canvas.
 * @returns A Blob in WebP format (falls back to JPEG if WebP unsupported).
 */
export async function compressImage(
  file: File,
  options?: CompressOptions
): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }
  const { maxWidth = 1800, quality = 0.82, format = "image/webp" } = options ?? {};

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxWidth / Math.max(width, height));
      if (scale < 1) {
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback: return original file
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // WebP not supported, try JPEG
            canvas.toBlob(
              (jpegBlob) => resolve(jpegBlob ?? file),
              "image/jpeg",
              quality
            );
          }
        },
        format,
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a small thumbnail for grid/avatar display.
 */
export async function generateThumbnail(
  file: File,
  size = 200
): Promise<Blob> {
  return compressImage(file, { maxWidth: size, quality: 0.7 });
}

/**
 * Helper: wraps a compressed Blob back into a File object for Supabase upload.
 */
export function blobToFile(blob: Blob, originalName: string): File {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const baseName = originalName.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type: blob.type });
}

/**
 * Check if a file is an image type.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}
