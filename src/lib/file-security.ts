import { blobToFile, compressImage } from "@/lib/image-utils";

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;

export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(",");
export const VIDEO_ACCEPT = VIDEO_MIME_TYPES.join(",");
export const MEDIA_ACCEPT = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",");

export function imageExtensionFor(file: Blob) {
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  return "jpg";
}

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
  ["image/webp", new Set(["webp"])],
]);

const VIDEO_EXTENSIONS = new Map([
  ["video/mp4", new Set(["mp4", "m4v"])],
  ["video/webm", new Set(["webm"])],
]);

function extensionOf(file: File) {
  return file.name.toLowerCase().split(".").pop() ?? "";
}

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

async function headerOf(file: File, size = 32) {
  return new Uint8Array(await file.slice(0, size).arrayBuffer());
}

function matchesImageSignature(mime: string, bytes: Uint8Array) {
  if (mime === "image/jpeg") return hasBytes(bytes, 0, [0xff, 0xd8, 0xff]);
  if (mime === "image/png") return hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/webp") {
    return hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50]);
  }
  return false;
}

function matchesVideoSignature(mime: string, bytes: Uint8Array) {
  if (mime === "video/mp4") return hasBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70]);
  if (mime === "video/webm") return hasBytes(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3]);
  return false;
}

function assertBasicFileRules(
  file: File,
  allowed: readonly string[],
  extensions: Map<string, Set<string>>,
  maxBytes: number,
) {
  if (!file.size) throw new Error("Le fichier est vide.");
  if (file.size > maxBytes) throw new Error(`Fichier trop volumineux (maximum ${Math.floor(maxBytes / 1024 / 1024)} Mo).`);
  if (!allowed.includes(file.type)) throw new Error("Type de fichier non autorisé.");
  if (!extensions.get(file.type)?.has(extensionOf(file))) throw new Error("L’extension ne correspond pas au type du fichier.");
}

export async function validateImageFile(file: File, maxBytes = 10 * 1024 * 1024) {
  assertBasicFileRules(file, IMAGE_MIME_TYPES, IMAGE_EXTENSIONS, maxBytes);
  if (!matchesImageSignature(file.type, await headerOf(file))) {
    throw new Error("Le contenu du fichier ne correspond pas à une image valide.");
  }
}

export async function validateVideoFile(file: File, maxBytes = 25 * 1024 * 1024) {
  assertBasicFileRules(file, VIDEO_MIME_TYPES, VIDEO_EXTENSIONS, maxBytes);
  if (!matchesVideoSignature(file.type, await headerOf(file))) {
    throw new Error("Le contenu du fichier ne correspond pas à une vidéo valide.");
  }
}

export async function safeImageForUpload(file: File, maxBytes = 10 * 1024 * 1024, maxWidth = 1800) {
  await validateImageFile(file, maxBytes);
  // Re-encoding through canvas strips active metadata and ensures that the stored
  // object is a real image. Never fall back to the untrusted original.
  const encoded = await compressImage(file, { maxWidth, quality: 0.82, format: "image/webp" });
  if (encoded === file) throw new Error("Cette image ne peut pas être réencodée de façon sûre.");
  if (!encoded.type || !IMAGE_MIME_TYPES.includes(encoded.type as (typeof IMAGE_MIME_TYPES)[number])) {
    throw new Error("Cette image ne peut pas être décodée de façon sûre.");
  }
  const safeFile = blobToFile(encoded, file.name);
  await validateImageFile(safeFile, maxBytes);
  return safeFile;
}

export async function readVideoDuration(file: File, timeoutMs = 10_000) {
  return await new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const cleanup = () => {
      window.clearTimeout(timer);
      video.onerror = null;
      video.onloadedmetadata = null;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    const fail = () => {
      cleanup();
      reject(new Error("La vidéo est illisible ou endommagée."));
    };
    const timer = window.setTimeout(fail, timeoutMs);
    video.preload = "metadata";
    video.onerror = fail;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error("Durée vidéo invalide."));
      else resolve(duration);
    };
    video.src = url;
  });
}
