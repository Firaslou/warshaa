// Warsha AI assistant — multilingual intent detection + targeted catalogue retrieval.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeSearchText, rankProducts, type SearchIntent, type SearchableProduct } from "./relevance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IntentKind = "product_search" | "creator_search" | "event_planning" | "product_recall" | "general";
interface ChatMsg { role: "user" | "assistant"; content: string }
interface AssistantContext {
  language?: string;
  intent?: IntentKind;
  event?: string | null;
  role?: string | null;
  budget?: number | null;
  style?: string | null;
  category?: string | null;
  city?: string | null;
}

interface IntentAnalysis extends SearchIntent {
  language: string;
  intent: IntentKind;
  role?: string | null;
  style?: string | null;
  needs?: string[];
  needs_clarification?: boolean;
  clarification_question?: string | null;
}

interface CreatorRow {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  category: string | null;
  categories: string[] | null;
  city: string | null;
  delegation: string | null;
}

interface ProductRow extends SearchableProduct {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  images: string[];
  category: string | null;
  in_stock: boolean;
  is_eco: boolean;
  delivery_available: boolean;
  delivery_fee: number | null;
  discount_percentage: number | null;
  creator: CreatorRow;
}

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const parseJsonObject = <T,>(value: string, fallback: T): T => {
  try {
    const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
};

const callGateway = async (
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
) => {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.25,
    }),
  });
  if (!response.ok) throw new Error(`AI gateway error (${response.status})`);
  const data = await response.json();
  return String(data.choices?.[0]?.message?.content ?? "{}");
};

const cleanMessages = (messages: ChatMsg[]) =>
  messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .slice(-12)
    .map((message) => ({ role: message.role, content: String(message.content ?? "").slice(0, 2_000) }));

const cleanAnalysis = (raw: Partial<IntentAnalysis>, fallbackLanguage: string): IntentAnalysis => {
  const allowedIntents: IntentKind[] = ["product_search", "creator_search", "event_planning", "product_recall", "general"];
  const numberOrNull = (value: unknown) => {
    const parsed = typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", ".").replace(/[^\d.]/g, ""))
        : Number.NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  return {
    language: String(raw.language || fallbackLanguage || "fr").slice(0, 12),
    intent: allowedIntents.includes(raw.intent as IntentKind) ? raw.intent as IntentKind : "general",
    query: String(raw.query ?? "").slice(0, 300),
    category: raw.category ? String(raw.category).slice(0, 80) : null,
    city: raw.city ? String(raw.city).slice(0, 80) : null,
    event: raw.event ? String(raw.event).slice(0, 80) : null,
    role: raw.role ? String(raw.role).slice(0, 80) : null,
    style: raw.style ? String(raw.style).slice(0, 80) : null,
    search_terms: Array.isArray(raw.search_terms) ? raw.search_terms.slice(0, 16).map((term) => String(term).slice(0, 60)) : [],
    needs: Array.isArray(raw.needs) ? raw.needs.slice(0, 8).map((need) => String(need).slice(0, 80)) : [],
    min_price: numberOrNull(raw.min_price),
    max_price: numberOrNull(raw.max_price),
    in_stock: raw.in_stock === true ? true : null,
    eco_only: raw.eco_only === true ? true : null,
    needs_clarification: raw.needs_clarification === true,
    clarification_question: raw.clarification_question ? String(raw.clarification_question).slice(0, 300) : null,
  };
};

const normalizeProduct = (row: Record<string, unknown>): ProductRow | null => {
  const relation = Array.isArray(row.startups) ? row.startups[0] : row.startups;
  if (!relation || typeof relation !== "object") return null;
  const creator = relation as CreatorRow;
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    price: row.price == null ? null : Number(row.price),
    currency: String(row.currency ?? "TND"),
    images: Array.isArray(row.images) ? row.images.map(String) : [],
    category: row.category == null ? null : String(row.category),
    in_stock: Boolean(row.in_stock),
    is_eco: Boolean(row.is_eco),
    delivery_available: Boolean(row.delivery_available),
    delivery_fee: row.delivery_fee == null ? null : Number(row.delivery_fee),
    discount_percentage: row.discount_percentage == null ? null : Number(row.discount_percentage),
    creator,
  };
};

const scoreCreator = (
  creator: CreatorRow,
  intent: IntentAnalysis,
  matchingProducts: ProductRow[],
  matchingCaptions: string[],
) => {
  const terms = [intent.query, intent.category, intent.city, intent.event, ...(intent.search_terms ?? [])]
    .filter(Boolean)
    .map((term) => normalizeSearchText(String(term)))
    .filter(Boolean);
  const searchable = normalizeSearchText([
    creator.name, creator.tagline, creator.description, creator.category,
    ...(creator.categories ?? []), creator.city, creator.delegation,
  ].filter(Boolean).join(" "));
  let score = 0;
  terms.forEach((term) => { if (searchable.includes(term)) score += 5; });
  score += matchingProducts.filter((product) => product.creator.id === creator.id).length * 6;
  score += matchingCaptions.filter((caption) => terms.some((term) => caption.includes(term))).length * 2;
  return score;
};

const defaultEventNeeds = (event: string | null | undefined) => {
  const normalized = normalizeSearchText(event);
  if (/wedding|mariage|عرس|3رس/.test(normalized)) return ["tenue", "bijoux", "sac", "cadeau", "décoration"];
  if (/birthday|anniversaire|ميلاد/.test(normalized)) return ["cadeau", "décoration", "gâteau", "tenue"];
  if (/graduation|diplome|تخرج/.test(normalized)) return ["cadeau", "tenue", "accessoires", "décoration"];
  return ["cadeau", "tenue", "accessoires", "décoration"];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userResult, error: userError } = await authClient.auth.getUser(authHeader.slice(7));
    if (userError || !userResult.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json() as { messages?: ChatMsg[]; context?: AssistantContext };
    const messages = cleanMessages(body.messages ?? []);
    if (!messages.some((message) => message.role === "user" && message.content.trim())) {
      return jsonResponse({ error: "A user message is required" }, 400);
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY missing");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language,preferred_categories,city")
      .eq("id", userResult.user.id)
      .maybeSingle();

    const classifierSystem = `You are the intent parser for Warsha, a Tunisian shopping marketplace. Understand French, English, Modern Standard Arabic, Tunisian Arabic (Arabic or Latin script), and code-switching. Never translate away meaning. Return strict JSON only with:
{"language":"fr|en|ar|tn","intent":"product_search|creator_search|event_planning|product_recall|general","query":"concise catalogue query","category":null,"city":null,"event":null,"role":null,"style":null,"search_terms":[],"min_price":null,"max_price":null,"in_stock":null,"eco_only":null,"needs":[],"needs_clarification":false,"clarification_question":null}
search_terms must include useful synonyms across the user's language and French catalogue wording. For event planning, needs should be concrete shopping needs. Ask at most one clarification question, only when essential. Use the previous structured context to resolve pronouns and follow-up constraints.`;
    const classifierInput = JSON.stringify({
      previous_context: body.context ?? {},
      user_profile: profile ?? {},
      conversation: messages,
    });
    const rawAnalysis = await callGateway(lovableApiKey, [
      { role: "system", content: classifierSystem },
      { role: "user", content: classifierInput },
    ]);
    const analysis = cleanAnalysis(
      parseJsonObject<Partial<IntentAnalysis>>(rawAnalysis, {}),
      profile?.preferred_language ?? body.context?.language ?? "fr",
    );

    const shouldSearchProducts = ["product_search", "product_recall", "event_planning"].includes(analysis.intent);
    const shouldSearchCreators = analysis.intent !== "general";
    const [productsResult, creatorsResult, storiesResult] = await Promise.all([
      shouldSearchProducts
        ? supabase.from("products")
            .select("id,name,description,price,currency,images,category,in_stock,is_eco,delivery_available,delivery_fee,discount_percentage,startups!inner(id,name,slug,tagline,description,logo_url,category,categories,city,delegation,status)")
            .eq("startups.status", "approved")
            .limit(250)
        : Promise.resolve({ data: [], error: null }),
      shouldSearchCreators
        ? supabase.from("startups")
            .select("id,name,slug,tagline,description,logo_url,category,categories,city,delegation")
            .eq("status", "approved")
            .limit(150)
        : Promise.resolve({ data: [], error: null }),
      shouldSearchCreators
        ? supabase.from("stories")
            .select("startup_id,caption")
            .gt("expires_at", new Date().toISOString())
            .limit(150)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsResult.error || creatorsResult.error || storiesResult.error) {
      throw new Error("Catalogue lookup failed");
    }

    const allProducts = (productsResult.data ?? [])
      .map((row) => normalizeProduct(row as unknown as Record<string, unknown>))
      .filter((product): product is ProductRow => Boolean(product));
    const creators = (creatorsResult.data ?? []) as CreatorRow[];
    const storyCaptions = (storiesResult.data ?? [])
      .map((story) => ({ startup_id: story.startup_id, caption: normalizeSearchText(story.caption) }));

    const hasSpecificProductRequest = Boolean(
      analysis.category || analysis.style || (analysis.search_terms?.length ?? 0) > 0,
    );
    const preferredTerms = hasSpecificProductRequest ? [] : profile?.preferred_categories ?? [];
    const baseSearch: IntentAnalysis = {
      ...analysis,
      city: analysis.city || profile?.city || body.context?.city || null,
      search_terms: [...(analysis.search_terms ?? []), ...preferredTerms.slice(0, 4)],
    };
    const rankedProducts = shouldSearchProducts ? rankProducts(allProducts, baseSearch, 12) : [];
    const needs = analysis.intent === "event_planning"
      ? (analysis.needs?.length ? analysis.needs : defaultEventNeeds(analysis.event))
      : [];
    const plan = needs.map((label) => ({
      label,
      products: rankProducts(allProducts, {
        ...baseSearch,
        query: `${label} ${analysis.event ?? ""}`,
        search_terms: [label, ...(analysis.search_terms ?? [])],
      }, 3),
    })).filter((item) => item.products.length > 0);
    const combinedProducts = [...new Map(
      [...plan.flatMap((item) => item.products), ...rankedProducts].map((product) => [product.id, product]),
    ).values()].slice(0, 12);

    const rankedCreators = creators
      .map((creator) => ({
        creator,
        score: scoreCreator(
          creator,
          baseSearch,
          combinedProducts,
          storyCaptions.filter((story) => story.startup_id === creator.id).map((story) => story.caption),
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ creator }) => creator);

    const compactProducts = combinedProducts.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description?.slice(0, 180),
      price: product.price,
      currency: product.currency,
      discount_percentage: product.discount_percentage,
      in_stock: product.in_stock,
      eco: product.is_eco,
      creator: product.creator.name,
      city: product.creator.city,
    }));
    const compactCreators = rankedCreators.map((creator) => ({
      slug: creator.slug,
      name: creator.name,
      category: creator.category,
      categories: creator.categories,
      city: creator.city,
      tagline: creator.tagline,
    }));

    const responseSystem = `You are Warsha's helpful Tunisian shopping assistant. Respond naturally in the user's detected language (${analysis.language}), preserving Tunisian Arabic and code-switching when used. Be concise but useful. Never invent products, prices, creators, availability, or links. Use only candidate IDs/slugs supplied below. If candidates are empty, say so honestly and ask one useful question. For event planning, briefly explain how to divide the budget and mention the generated checklist. Return strict JSON only:
{"reply":"answer","product_ids":[],"creator_slugs":[]}`;
    const responseInput = JSON.stringify({
      intent: analysis,
      previous_context: body.context ?? {},
      latest_messages: messages.slice(-6),
      products: compactProducts,
      creators: compactCreators,
      checklist: plan.map((item) => ({ label: item.label, product_ids: item.products.map((product) => product.id) })),
    });
    const rawResponse = await callGateway(lovableApiKey, [
      { role: "system", content: responseSystem },
      { role: "user", content: responseInput },
    ]);
    const composed = parseJsonObject<{ reply?: string; product_ids?: string[]; creator_slugs?: string[] }>(rawResponse, {});
    const productById = new Map(combinedProducts.map((product) => [product.id, product]));
    const creatorBySlug = new Map(rankedCreators.map((creator) => [creator.slug, creator]));
    const selectedProducts = (composed.product_ids ?? [])
      .map((id) => productById.get(id))
      .filter((product): product is ProductRow => Boolean(product));
    const selectedCreators = (composed.creator_slugs ?? [])
      .map((slug) => creatorBySlug.get(slug))
      .filter((creator): creator is CreatorRow => Boolean(creator));

    const context: AssistantContext = {
      language: analysis.language,
      intent: analysis.intent,
      event: analysis.event ?? body.context?.event ?? null,
      role: analysis.role ?? body.context?.role ?? null,
      budget: analysis.max_price ?? body.context?.budget ?? null,
      style: analysis.style ?? body.context?.style ?? null,
      category: analysis.category ?? body.context?.category ?? null,
      city: analysis.city ?? body.context?.city ?? profile?.city ?? null,
    };
    const fallbackReply = analysis.clarification_question
      || (combinedProducts.length || rankedCreators.length
        ? "Voici les options Warsha qui correspondent le mieux à ta recherche."
        : "Je n'ai pas encore trouvé de correspondance. Peux-tu préciser le produit, le budget ou la ville ?");

    return jsonResponse({
      reply: composed.reply?.trim() || fallbackReply,
      intent: analysis.intent,
      context,
      products: selectedProducts.length ? selectedProducts : combinedProducts.slice(0, 6),
      creators: selectedCreators.length ? selectedCreators : rankedCreators.slice(0, 4),
      plan,
    });
  } catch (error) {
    console.error("ai-assistant error", error);
    return jsonResponse({ error: "Assistant temporarily unavailable" }, 500);
  }
});
