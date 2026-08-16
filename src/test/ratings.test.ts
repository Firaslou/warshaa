import { describe, expect, it } from "vitest";
import { aggregateRatings } from "@/lib/ratings";

describe("aggregateRatings", () => {
  it("computes independent averages and ignores invalid rows", () => {
    expect(aggregateRatings([
      { product_id: "a", rating: 5 },
      { product_id: "a", rating: 3 },
      { product_id: "b", rating: 2 },
      { product_id: null, rating: 5 },
    ], "product_id")).toEqual({
      a: { average: 4, count: 2 },
      b: { average: 2, count: 1 },
    });
  });
});
