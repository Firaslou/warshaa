import { describe, expect, it } from "vitest";
import { validateImageFile, validateVideoFile } from "@/lib/file-security";

const file = (bytes: number[], name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });

describe("secure file validation", () => {
  it("accepts valid image signatures", async () => {
    await expect(validateImageFile(file([0xff, 0xd8, 0xff, 0xdb], "photo.jpg", "image/jpeg"))).resolves.toBeUndefined();
    await expect(validateImageFile(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "photo.png", "image/png"))).resolves.toBeUndefined();
  });

  it("rejects SVG, spoofed MIME types, mismatched extensions and empty files", async () => {
    await expect(validateImageFile(file([0x3c, 0x73, 0x76, 0x67], "attack.svg", "image/svg+xml"))).rejects.toThrow();
    await expect(validateImageFile(file([0x3c, 0x68, 0x74, 0x6d], "attack.jpg", "image/jpeg"))).rejects.toThrow();
    await expect(validateImageFile(file([0xff, 0xd8, 0xff], "attack.png", "image/jpeg"))).rejects.toThrow();
    await expect(validateImageFile(new File([], "empty.jpg", { type: "image/jpeg" }))).rejects.toThrow();
  });

  it("accepts MP4/WebM signatures and rejects renamed text", async () => {
    await expect(validateVideoFile(file([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70], "clip.mp4", "video/mp4"))).resolves.toBeUndefined();
    await expect(validateVideoFile(file([0x1a, 0x45, 0xdf, 0xa3], "clip.webm", "video/webm"))).resolves.toBeUndefined();
    await expect(validateVideoFile(file([0x3c, 0x68, 0x74, 0x6d], "clip.mp4", "video/mp4"))).rejects.toThrow();
  });
});
