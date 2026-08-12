import { describe, expect, it } from "vitest";
import {
  finalProductPrice,
  normalizeSearchText,
  rankProducts,
  scoreProduct,
  type SearchableProduct,
} from "../../supabase/functions/ai-assistant/relevance";

const product = (overrides: Partial<SearchableProduct> = {}): SearchableProduct => ({
  id: "product-1",
  name: "Robe noire simple",
  description: "Tenue élégante faite main pour mariage",
  category: "Mode",
  price: 250,
  discount_percentage: 20,
  in_stock: true,
  is_eco: false,
  creator: {
    name: "Atelier Tunis",
    city: "Tunis",
    category: "Mode",
    categories: ["Femme", "Robes"],
  },
  ...overrides,
});

describe("assistant catalogue relevance", () => {
  it("normalizes accents and Arabic letter variants", () => {
    expect(normalizeSearchText("Céramique ÉLÉGANTE")).toBe("ceramique elegante");
    expect(normalizeSearchText("إكسسوارات عربية")).toBe("اكسسوارات عربيه");
  });

  it("uses the discounted price for budget filters", () => {
    const item = product();
    expect(finalProductPrice(item)).toBe(200);
    expect(scoreProduct(item, { query: "robe mariage", max_price: 210 })).toBeGreaterThan(0);
    expect(scoreProduct(item, { query: "robe mariage", max_price: 190 })).toBe(-Infinity);
  });

  it("ranks real matching products ahead of unrelated products", () => {
    const unrelated = product({
      id: "product-2",
      name: "Bougie au jasmin",
      description: "Décoration parfumée",
      category: "Bougies",
      creator: { name: "Lumina", city: "Sousse", category: "Bougies", categories: ["Maison"] },
    });
    const ranked = rankProducts([unrelated, product()], {
      query: "robe simple mariage",
      category: "Mode",
      city: "Tunis",
      max_price: 300,
      in_stock: true,
    });
    expect(ranked.map((item) => item.id)).toEqual(["product-1"]);
  });

  it("does not recommend an unrelated product only because it is nearby", () => {
    const nearbyButUnrelated = product({
      id: "product-3",
      name: "Bougie au jasmin",
      description: "Décoration parfumée",
      category: "Bougies",
      creator: { name: "Lumina", city: "Tunis", category: "Bougies", categories: ["Maison"] },
    });
    expect(rankProducts([nearbyButUnrelated], {
      query: "robe mariage",
      category: "Mode",
      city: "Tunis",
    })).toEqual([]);
  });

  it("excludes unavailable products when stock is required", () => {
    const ranked = rankProducts([product({ in_stock: false })], {
      query: "robe",
      in_stock: true,
    });
    expect(ranked).toEqual([]);
  });
});
