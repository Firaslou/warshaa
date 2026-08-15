// AI product description helper — turns keywords into a polished description
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
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: claimsErr } = await authClient.auth.getUser(token);
    if (claimsErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isStartup } = await admin.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "startup",
    });
    if (!isStartup) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { name, category, keywords } = (await req.json()) as {
      name?: string;
      category?: string;
      keywords?: string;
    };
    if (!keywords || keywords.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Mots-clés requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (keywords.length > 500) {
      return new Response(JSON.stringify({ error: "Mots-clés trop longs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const system = `Tu écris des descriptions produits pour Warsha, marketplace de créateurs tunisiens. Style: chaleureux, sincère, sensoriel, vendeur sans exagération. Français naturel. 2 à 4 phrases, max 400 caractères. Pas d'emoji, pas de hashtag, pas de prix. Mets en avant matière, fabrication artisanale, usage, et ce qui rend le produit spécial. Réponds UNIQUEMENT avec la description finale, rien d'autre.`;

    const userPrompt = `Nom: ${name || "(non précisé)"}\nCatégorie: ${category || "(non précisée)"}\nMots-clés / notes du créateur: ${keywords}`;

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
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
    let description: string = (data.choices?.[0]?.message?.content ?? "").trim();
    if (description.length > 500) description = description.slice(0, 500);
    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});