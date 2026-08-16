import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeSearchText,
  fuzzyMatch,
  getSearchHistory,
  saveSearchQuery,
  removeSearchHistoryItem,
  clearSearchHistory,
  levenshteinDistance,
} from "@/lib/search-utils";

describe("search-utils", () => {
  beforeEach(() => {
    clearSearchHistory();
  });

  describe("normalizeSearchText", () => {
    it("removes French diacritics and converts to lowercase", () => {
      expect(normalizeSearchText("Céramique Émaillée")).toBe("ceramique emaillee");
      expect(normalizeSearchText("PÔTERIE TRADITIONNELLE")).toBe("poterie traditionnelle");
    });

    it("normalizes Arabic characters", () => {
      expect(normalizeSearchText("أواني فخارية")).toBe("اواني فخاريه");
    });
  });

  describe("levenshteinDistance", () => {
    it("computes distance between strings", () => {
      expect(levenshteinDistance("potrie", "poterie")).toBe(1);
      expect(levenshteinDistance("tapis", "tapis")).toBe(0);
    });
  });

  describe("fuzzyMatch", () => {
    it("matches exact substrings regardless of casing/accents", () => {
      expect(fuzzyMatch("ceramique", "Vase en Céramique Bleue")).toBe(true);
      expect(fuzzyMatch("poterie", "Atelier de poterie")).toBe(true);
      expect(fuzzyMatch("autoecole", "Auto-école à Tunis")).toBe(true);
    });

    it("tolerates typos with levenshtein tolerance", () => {
      // 1-letter typo in "potrie" -> "poterie"
      expect(fuzzyMatch("potrie", "Atelier de poterie de Nabeul")).toBe(true);
    });

    it("returns false for completely unrelated terms", () => {
      expect(fuzzyMatch("chaussures", "Table en bois d'olivier")).toBe(false);
    });
  });

  describe("search history persistence", () => {
    it("saves and retrieves search items without duplicates", () => {
      saveSearchQuery("Poterie");
      saveSearchQuery("Céramique");
      saveSearchQuery("Poterie");

      const history = getSearchHistory();
      expect(history).toEqual(["Poterie", "Céramique"]);
    });

    it("removes single item from history", () => {
      saveSearchQuery("Cuir");
      saveSearchQuery("Tapis");
      removeSearchHistoryItem("Cuir");

      expect(getSearchHistory()).toEqual(["Tapis"]);
    });

    it("clears entire search history", () => {
      saveSearchQuery("Huile");
      clearSearchHistory();
      expect(getSearchHistory()).toEqual([]);
    });
  });
});
