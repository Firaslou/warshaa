// Image search — analyze uploaded inspiration photo, return similar products
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const bytesFromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
const sha256 = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const findExactImageMatches = async (products: any[], uploadedHash: string) => {
  const matches: string[] = [];
  const candidates = products.filter((product) => product.images?.[0]);
  for (let offset = 0; offset < candidates.length; offset += 8) {
    const batch = candidates.slice(offset, offset + 8);
    const results = await Promise.allSettled(batch.map(async (product) => {
      const response = await fetch(product.images[0], { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) return null;
      const hash = await sha256(new Uint8Array(await response.arrayBuffer()));
      return hash === uploadedHash ? product.id : null;
    }));
    results.forEach((result) => { if (result.status === "fulfilled" && result.value) matches.push(result.value); });
  }
  return matches;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes, error: userErr } = await authClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (userErr || !userRes?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType.toLowerCase() : "image/jpeg";
    if (!imageBase64) return new Response(JSON.stringify({ error: "imageBase64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return new Response(JSON.stringify({ error: "Only JPEG, PNG and WebP images are supported" }), { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (imageBase64.length > 14_000_000) return new Response(JSON.stringify({ error: "Image too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!(await consumeRateLimit(supabase, userRes.user.id, "image-search", 8, 60))) {
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: products } = await supabase.from("products")
      .select("id,name,description,category,images,startup_id,startups!inner(status)")
      .eq("is_published", true).eq("startups.status", "approved").limit(300);
    const catalog = (products ?? []).map((p: any) => ({ id: p.id, name: p.name, desc: (p.description ?? "").slice(0, 180), cat: p.category, image: p.images?.[0] ?? null }));
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    const uploadedBytes = bytesFromBase64(imageBase64);
    if (uploadedBytes.length > 10 * 1024 * 1024) return new Response(JSON.stringify({ error: "Image too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const uploadedHash = await sha256(uploadedBytes);
    const exactMatchIds = await findExactImageMatches(products ?? [], uploadedHash);

    if (exactMatchIds.length) {
      const { data: exactProducts } = await supabase.from("products")
        .select("id,name,description,price,currency,images,category,startup_id,startups!inner(name,slug,status)")
        .in("id", exactMatchIds).eq("is_published", true).eq("startups.status", "approved");
      const exactById = new Map((exactProducts ?? []).map((product) => [product.id, product]));
      return new Response(JSON.stringify({ description: "Cette image correspond exactement a un produit du catalogue.", results: exactMatchIds.map((id) => exactById.get(id)).filter(Boolean) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const visualCatalog = catalog.filter((product) => product.image).slice(0, 60);
    const catalogMetadata = catalog.map(({ image, ...product }) => product);
    const visualContent: any[] = [
      { type: "text", text: "Image recherchee par l'utilisateur :" },
      { type: "image_url", image_url: { url: dataUrl } },
      { type: "text", text: `Catalogue textuel complet: ${JSON.stringify(catalogMetadata)}\n\nCompare visuellement avec les images catalogue suivantes. Chaque image est precedee de son product_id :` },
    ];
    visualCatalog.forEach((product) => {
      visualContent.push({ type: "text", text: `product_id: ${product.id}; nom: ${product.name}; categorie: ${product.cat ?? "inconnue"}` }, { type: "image_url", image_url: { url: product.image } });
    });

    const system = `Tu es un assistant de recherche visuelle pour Warsha, plateforme de créateurs tunisiens. Analyse l'image envoyée par l'utilisateur et trouve les produits du catalogue qui ressemblent le plus. Réponds en JSON strict: {"description":"<max 2 phrases>","matches":["<product_id>", ...]}. Utilise uniquement des ids du catalogue, jusqu'à 8.`;
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GEMINI_API_KEY}` },
      body: JSON.stringify({ model: "gemini-2.5-flash", messages: [{ role: "system", content: system }, { role: "user", content: visualContent }], response_format: { type: "json_object" } }),
    });
    if (!res.ok) return new Response(JSON.stringify({ error: "Image search provider failed" }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const data = await res.json();
    let parsed: { description?: string; matches?: string[] } = {};
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }
    const validIds = new Set(catalog.map((product) => product.id));
    const ids = [...new Set([...(parsed.matches ?? []).filter((id) => validIds.has(id))])].slice(0, 8);
    let results: any[] = [];
    if (ids.length) {
      const { data: prods } = await supabase.from("products")
        .select("id,name,description,price,currency,images,category,startup_id,startups!inner(name,slug,status)")
        .in("id", ids).eq("is_published", true).eq("startups.status", "approved");
      const map = new Map((prods ?? []).map((p) => [p.id, p]));
      results = ids.map((id) => map.get(id)).filter(Boolean);
    }
    return new Response(JSON.stringify({ description: parsed.description ?? "", results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Image search error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
