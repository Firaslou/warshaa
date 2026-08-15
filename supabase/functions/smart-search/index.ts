// Smart search — parse natural-language queries into product filters via Lovable AI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes, error: claimsErr } = await authClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (claimsErr || !userRes?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) return new Response(JSON.stringify({ error: "query required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (query.length > 500) return new Response(JSON.stringify({ error: "query too long" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const system = `Tu es un parseur de recherche e-commerce en français/arabe/anglais. À partir d'une requête utilisateur libre, retourne UNIQUEMENT un JSON strict avec ces champs:
{"keywords":string[],"color":string|null,"max_price":number|null,"min_price":number|null,"category":string|null,"city":string|null,"delivery_required":boolean}
Devise par défaut: TND (accepter dt, dinar, tnd). Ne renvoie RIEN d'autre que le JSON.`;
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GEMINI_API_KEY}` },
      body: JSON.stringify({ model: "gemini-2.5-flash", messages: [{ role: "system", content: system }, { role: "user", content: query }], response_format: { type: "json_object" } }),
    });
    if (!aiRes.ok) return new Response(JSON.stringify({ error: "AI search failed" }), { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let filters: any = {};
    try { filters = JSON.parse(raw); } catch { filters = {}; }

    let q = supabase.from("products")
      .select("id,name,description,price,currency,images,category,delegation,delivery_available,delivery_fee,startup_id,startups!inner(slug,name,city,status)")
      .eq("is_published", true).eq("startups.status", "approved").limit(60);
    if (typeof filters.max_price === "number" && Number.isFinite(filters.max_price) && filters.max_price >= 0) q = q.lte("price", filters.max_price);
    if (typeof filters.min_price === "number" && Number.isFinite(filters.min_price) && filters.min_price >= 0) q = q.gte("price", filters.min_price);
    if (filters.delivery_required === true) q = q.eq("delivery_available", true);

    const terms: string[] = [...(Array.isArray(filters.keywords) ? filters.keywords : []), filters.color, filters.category]
      .filter((t) => typeof t === "string" && t.trim().length > 1)
      .slice(0, 12)
      .map((t) => String(t).trim().slice(0, 80));
    const { data: rows, error: queryError } = await q;
    if (queryError) throw queryError;
    let products = rows ?? [];
    if (terms.length && products.length) {
      const lc = terms.map((t) => t.toLowerCase());
      products = products.map((p: any) => {
        const hay = `${p.name} ${p.description ?? ""} ${p.category ?? ""}`.toLowerCase();
        const score = lc.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
        return { ...p, _score: score };
      }).filter((p: any) => p._score > 0).sort((a: any, b: any) => b._score - a._score);
    }
    if (typeof filters.city === "string" && filters.city.trim() && products.length) {
      const c = filters.city.trim().toLowerCase().slice(0, 80);
      products = products.filter((p: any) => (p.startups?.city ?? "").toLowerCase().includes(c) || (p.delegation ?? "").toLowerCase().includes(c));
    }
    return new Response(JSON.stringify({ filters, products: products.slice(0, 24) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Search error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
