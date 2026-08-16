import { describe, expect, it } from "vitest";
import { isValidContactPhone, normalizeCallablePhone } from "@/lib/phone";

describe("phone contact helpers", () => {
  it("normalizes safe international call links", () => {
    expect(normalizeCallablePhone("+216 12 345 678")).toBe("+21612345678");
    expect(normalizeCallablePhone("71-234-567")).toBe("71234567");
  });

  it("rejects unusable phone values", () => {
    expect(isValidContactPhone("123")).toBe(false);
    expect(isValidContactPhone("javascript:alert(1)")).toBe(false);
  });
});
