import { describe, expect, it } from "vitest";
import { safeExternalUrl, safeMediaUrl } from "@/lib/url-security";

describe("URL security", () => {
  it("normalizes ordinary social links to HTTPS", () => {
    expect(safeExternalUrl("instagram.com/warsha")).toBe("https://instagram.com/warsha");
  });

  it("allows HTTP(S) links and blocks executable schemes", () => {
    expect(safeExternalUrl("https://example.com/profile")).toBe("https://example.com/profile");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
  });

  it("permits blob media previews without allowing data URLs", () => {
    expect(safeMediaUrl("blob:https://warsha.example/1234")).toBe("blob:https://warsha.example/1234");
    expect(safeMediaUrl("data:text/html,unsafe")).toBeNull();
  });
});
