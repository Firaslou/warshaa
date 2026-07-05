// AI shopping assistant — recommends creators based on user need
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMsg { role: "user" | "assistant"; content: string }

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
    const { messages } = (await req.json()) as { messages: ChatMsg[] };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: startups } = await supabase
      .from("startups")
      .select("name,slug,tagline,description,category,categories,city,delegation")
      .eq("status", "approved")
      .limit(200);

    const catalog = (startups ?? []).map((s, i) => ({
      i,
      name: s.name,
      slug: s.slug,
      tagline: s.tagline,
      desc: (s.description ?? "").slice(0, 220),
      cat: s.category,
      cats: s.categories,
      city: s.city,
      delegation: s.delegation,
    }));

    const system = `Tu es l'assistant shopping de Warsha, une plateforme de créateurs tunisiens. Tu aides les visiteurs à trouver le bon créateur ou produit selon leur besoin. Réponds en français, ton chaleureux et concis (max 3 phrases). À la fin de ta réponse, ajoute STRICTEMENT une ligne au format:\nRECOMMEND: slug1, slug2, slug3\nUtilise UNIQUEMENT des slugs présents dans le catalogue ci-dessous. Recommande 1 à 4 créateurs pertinents. Si rien ne correspond, écris RECOMMEND: (vide).\n\nCatalogue (JSON):\n${JSON.stringify(catalog)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...messages],
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
    const full: string = data.choices?.[0]?.message?.content ?? "";
    const m = full.match(/RECOMMEND:\s*([^\n]*)/i);
    const slugs = m
      ? m[1].split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const reply = full.replace(/RECOMMEND:[^\n]*/i, "").trim();

    let recommendations: any[] = [];
    if (slugs.length) {
      const { data: recs } = await supabase
        .from("startups")
        .select("id,name,slug,tagline,logo_url,category,city")
        .in("slug", slugs)
        .eq("status", "approved");
      recommendations = recs ?? [];
    }

    return new Response(JSON.stringify({ reply, recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});