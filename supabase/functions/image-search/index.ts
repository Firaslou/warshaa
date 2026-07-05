// Image search — analyze uploaded inspiration photo, return similar products
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
    const { imageBase64, mimeType } = (await req.json()) as {
      imageBase64: string;
      mimeType?: string;
    };
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Reject oversized payloads (>10MB decoded)
    if (imageBase64.length > 14_000_000) {
      return new Response(JSON.stringify({ error: "Image too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: products } = await supabase
      .from("products")
      .select("id,name,description,category,images,startup_id,startups!inner(status)")
      .eq("startups.status", "approved")
      .limit(300);

    const catalog = (products ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      desc: (p.description ?? "").slice(0, 180),
      cat: p.category,
    }));

    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

    const system = `Tu es un assistant de recherche visuelle pour Warsha, plateforme de créateurs tunisiens. Analyse l'image envoyée par l'utilisateur (style, couleur, matière, catégorie, ambiance) et trouve les produits du catalogue qui ressemblent le plus visuellement ou par catégorie. Réponds en JSON strict avec ce format:\n{"description":"<courte description visuelle de l'image en français, max 2 phrases>","matches":["<product_id>", ...]}\nMets jusqu'à 8 product_id pertinents par ordre décroissant de pertinence. Utilise UNIQUEMENT des ids du catalogue. Si rien ne correspond, matches=[].`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: `Catalogue: ${JSON.stringify(catalog)}` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: txt }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    let parsed: { description?: string; matches?: string[] } = {};
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    } catch {
      parsed = {};
    }
    const ids = (parsed.matches ?? []).filter(Boolean);
    let results: any[] = [];
    if (ids.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,description,price,currency,images,category,startup_id,startups!inner(name,slug,status)")
        .in("id", ids)
        .eq("startups.status", "approved");
      const map = new Map((prods ?? []).map((p) => [p.id, p]));
      results = ids.map((id) => map.get(id)).filter(Boolean);
    }

    return new Response(
      JSON.stringify({ description: parsed.description ?? "", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});