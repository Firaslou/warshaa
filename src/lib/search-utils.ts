/**
 * Utility functions for smart, typo-tolerant search and search history persistence.
 */

const HISTORY_STORAGE_KEY = "warsha_search_history";
const MAX_HISTORY_ITEMS = 8;

/**
 * Normalizes text by removing accents, diacritics, special Arabic marks, and converting to lowercase.
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove French/Latin diacritics
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove Arabic harakat / tashkeel
    .replace(/[أإآ]/g, "ا") // normalize Arabic alef
    .replace(/ة/g, "ه") // normalize teh marbuta
    .replace(/ى/g, "ي") // normalize alef maksura
    .toLowerCase()
    .trim();
}

/**
 * Calculates Levenshtein distance between two short strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if a target string matches a query with typo tolerance and token matching.
 */
export function fuzzyMatch(query: string, target: string | null | undefined): boolean {
  if (!query) return true;
  if (!target) return false;

  const normQuery = normalizeSearchText(query);
  const normTarget = normalizeSearchText(target);

  // Exact substring match after normalization
  if (normTarget.includes(normQuery)) return true;

  const queryTokens = normQuery.split(/\s+/).filter((t) => t.length > 0);
  const targetTokens = normTarget.split(/\s+/).filter((t) => t.length > 0);

  // Every word in query should match at least one word in target
  return queryTokens.every((qToken) => {
    return targetTokens.some((tToken) => {
      // Direct prefix or substring
      if (tToken.includes(qToken) || qToken.includes(tToken)) return true;

      // Allow 1 typo for tokens >= 4 chars, 2 typos for tokens >= 7 chars
      if (qToken.length >= 4) {
        const maxDist = qToken.length >= 7 ? 2 : 1;
        const dist = levenshteinDistance(qToken, tToken.slice(0, Math.max(qToken.length, tToken.length)));
        if (dist <= maxDist) return true;
      }

      return false;
    });
  });
}

/**
 * Retrieves the recent search queries from localStorage.
 */
export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves a new query to the search history.
 */
export function saveSearchQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return getSearchHistory();

  try {
    const current = getSearchHistory();
    const updated = [trimmed, ...current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
      0,
      MAX_HISTORY_ITEMS
    );
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return getSearchHistory();
  }
}

/**
 * Removes a specific query from search history.
 */
export function removeSearchHistoryItem(query: string): string[] {
  try {
    const current = getSearchHistory();
    const updated = current.filter((item) => item.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return getSearchHistory();
  }
}

/**
 * Clears all search history.
 */
export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Some privacy modes disable Web Storage; clearing is best-effort.
  }
}
