export interface SearchIntent {
  query?: string;
  category?: string | null;
  city?: string | null;
  event?: string | null;
  style?: string | null;
  search_terms?: string[];
  min_price?: number | null;
  max_price?: number | null;
  in_stock?: boolean | null;
  eco_only?: boolean | null;
}

export interface SearchableProduct {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  delegation?: string | null;
  price?: number | null;
  discount_percentage?: number | null;
  in_stock?: boolean;
  is_eco?: boolean;
  creator?: {
    name?: string | null;
    city?: string | null;
    delegation?: string | null;
    category?: string | null;
    categories?: string[] | null;
  } | null;
}

export const normalizeSearchText = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const tokenizeSearchText = (value: string | null | undefined) =>
  [...new Set(normalizeSearchText(value).split(/\s+/).filter((token) => token.length > 1))];

export const finalProductPrice = (product: SearchableProduct) => {
  if (product.price == null) return null;
  const discount = Math.max(0, Math.min(100, product.discount_percentage ?? 0));
  return product.price * (1 - discount / 100);
};

export const scoreProduct = (product: SearchableProduct, intent: SearchIntent) => {
  const price = finalProductPrice(product);
  if (intent.min_price != null && (price == null || price < intent.min_price)) return -Infinity;
  if (intent.max_price != null && (price == null || price > intent.max_price)) return -Infinity;
  if (intent.in_stock === true && !product.in_stock) return -Infinity;
  if (intent.eco_only === true && !product.is_eco) return -Infinity;

  const semanticTerms = tokenizeSearchText([
    intent.query,
    intent.category,
    intent.event,
    intent.style,
    ...(intent.search_terms ?? []),
  ].filter(Boolean).join(" "));
  const normalizedCity = normalizeSearchText(intent.city);
  if (semanticTerms.length === 0 && !normalizedCity) return product.in_stock ? 1 : 0;

  const fields = {
    name: normalizeSearchText(product.name),
    category: normalizeSearchText(product.category),
    description: normalizeSearchText(product.description),
    creator: normalizeSearchText(product.creator?.name),
    creatorCategories: normalizeSearchText([
      product.creator?.category,
      ...(product.creator?.categories ?? []),
    ].filter(Boolean).join(" ")),
    location: normalizeSearchText([
      product.delegation,
      product.creator?.city,
      product.creator?.delegation,
    ].filter(Boolean).join(" ")),
  };

  let score = 0;
  for (const term of semanticTerms) {
    if (fields.name.includes(term)) score += 10;
    if (fields.category.includes(term)) score += 8;
    if (fields.creatorCategories.includes(term)) score += 6;
    if (fields.description.includes(term)) score += 4;
    if (fields.creator.includes(term)) score += 3;
  }

  if (intent.category && fields.category.includes(normalizeSearchText(intent.category))) score += 12;
  // Location is a ranking bonus, never sufficient to recommend a semantically unrelated item.
  if (semanticTerms.length > 0 && score === 0) return 0;
  if (normalizedCity && fields.location.includes(normalizedCity)) score += 8;
  if (score === 0) return 0;
  if (product.in_stock) score += 2;
  if (product.is_eco) score += 0.5;
  return score;
};

export const rankProducts = <T extends SearchableProduct>(products: T[], intent: SearchIntent, limit = 12) =>
  products
    .map((product) => ({ product, score: scoreProduct(product, intent) }))
    .filter(({ score }) => Number.isFinite(score) && score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => product);
