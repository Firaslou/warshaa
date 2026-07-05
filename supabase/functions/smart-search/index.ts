// Smart search — parse natural-language queries into product filters via Lovable AI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsRes, error: claimsErr } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsRes?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { query } = (await req.json()) as { query: string };
    if (!query || typeof query !== "string") throw new Error("query required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const system = `Tu es un parseur de recherche e-commerce en français/arabe/anglais. À partir d'une requête utilisateur libre, retourne UNIQUEMENT un JSON strict avec ces champs:
{
  "keywords": string[],        // mots-clés produits (ex: "robe", "traditionnelle")
  "color": string|null,         // couleur si mentionnée (ex: "bleu")
  "max_price": number|null,     // prix max en TND
  "min_price": number|null,
  "category": string|null,      // catégorie principale devinée
  "city": string|null,          // ville/gouvernorat si mentionné
  "delivery_required": boolean
}
Devise par défaut: TND (accepter "dt", "dinar", "tnd"). Ne renvoie RIEN d'autre que le JSON.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: query },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: txt }), {
        status: aiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let filters: any = {};
    try { filters = JSON.parse(raw); } catch { filters = {}; }

    let q = supabase
      .from("products")
      .select("id,name,description,price,currency,images,category,delegation,delivery_available,delivery_fee,startup_id,startups!inner(slug,name,city,status)")
      .eq("startups.status", "approved")
      .limit(60);

    if (typeof filters.max_price === "number") q = q.lte("price", filters.max_price);
    if (typeof filters.min_price === "number") q = q.gte("price", filters.min_price);
    if (filters.delivery_required) q = q.eq("delivery_available", true);

    // Build OR text search across name/description for keywords + color
    const terms: string[] = [
      ...(Array.isArray(filters.keywords) ? filters.keywords : []),
      filters.color,
      filters.category,
    ].filter((t) => typeof t === "string" && t.trim().length > 1);

    const { data: rows } = await q;
    let products = rows ?? [];

    if (terms.length && products.length) {
      const lc = terms.map((t) => t.toLowerCase());
      products = products
        .map((p: any) => {
          const hay = `${p.name} ${p.description ?? ""} ${p.category ?? ""}`.toLowerCase();
          const score = lc.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
          return { ...p, _score: score };
        })
        .filter((p: any) => p._score > 0)
        .sort((a: any, b: any) => b._score - a._score);
    }

    if (filters.city && products.length) {
      const c = String(filters.city).toLowerCase();
      products = products.filter((p: any) =>
        (p.startups?.city ?? "").toLowerCase().includes(c) ||
        (p.delegation ?? "").toLowerCase().includes(c)
      );
    }

    return new Response(JSON.stringify({ filters, products: products.slice(0, 24) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});