import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const terms = (s: string) => norm(s).split(/[^a-z0-9\u0600-\u06ff]+/).filter((x) => x.length > 2);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userResult, error: userError } = await client.auth.getUser(auth.slice(7));
    if (userError || !userResult.user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const text = String(messages.filter((m: any) => m?.role === "user").at(-1)?.content ?? "").trim();
    if (!text) return json({ error: "A user message is required" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const q = norm(text);
    const t = terms(text);
    const budgetMatch = q.match(/(?:moins de|sous|a|pour|budget)\s*(\d{2,5})\s*(?:dt|dinars)?/);
    const budget = budgetMatch ? Number(budgetMatch[1]) : null;
    const event = /mariage|wedding|3ers|3ars|عرس/.test(q) ? "mariage" : /anniversaire|birthday|ميلاد/.test(q) ? "anniversaire" : /diplome|graduation|تخرج/.test(q) ? "graduation" : null;

    const { data: products } = await db.from("products")
      .select("id,name,description,price,currency,images,category,in_stock,is_eco,discount_percentage,startups!inner(id,name,slug,tagline,logo_url,category,city,status)")
      .eq("is_published", true).eq("startups.status", "approved").limit(250);
    const { data: creators } = await db.from("startups")
      .select("id,name,slug,tagline,logo_url,category,city,status").eq("status", "approved").limit(150);

    const score = (value: string) => t.reduce((n, x) => value.includes(x) ? n + 1 : n, 0);
    const matchedProducts = (products ?? []).map((p: any) => {
      const c = Array.isArray(p.startups) ? p.startups[0] : p.startups;
      const hay = norm([p.name, p.description, p.category, c?.name, c?.tagline, c?.category, c?.city].join(" "));
      let s = score(hay);
      if (budget != null && p.price != null && Number(p.price) <= budget) s += 4;
      if (event) s += score(norm(`${event} ${p.category ?? ""} ${p.name} ${p.description ?? ""}`));
      return { p, c, s };
    }).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).slice(0, 12);

    const matchedCreators = (creators ?? []).map((c: any) => ({ c, s: score(norm([c.name, c.tagline, c.category, c.city].join(" "))) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).slice(0, 6).map((x: any) => x.c);

    const productOut = matchedProducts.map(({ p, c }: any) => ({
      id: p.id, name: p.name, description: p.description, price: p.price, currency: p.currency,
      images: p.images ?? [], category: p.category, in_stock: p.in_stock, is_eco: p.is_eco,
      discount_percentage: p.discount_percentage, creator: { id: c?.id, name: c?.name, slug: c?.slug, tagline: c?.tagline, logo_url: c?.logo_url, category: c?.category, city: c?.city }
    }));
    const creatorOut = matchedCreators.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, tagline: c.tagline, logo_url: c.logo_url, category: c.category, city: c.city }));

    let reply = "Je peux chercher des produits et des créateurs Warsha. Essaie par exemple : « un cadeau pour ma mère », « une tenue à moins de 300 DT » ou donne-moi le nom d'un produit. 🌿";
    if (productOut.length) reply = `J'ai trouvé ${productOut.length} résultat${productOut.length > 1 ? "s" : ""} qui pourraient correspondre à ta recherche. 🌿`;
    else if (creatorOut.length) reply = `J'ai trouvé ${creatorOut.length} créateur${creatorOut.length > 1 ? "s" : ""} qui pourraient t'intéresser. 🌿`;
    else if (event) reply = `Je peux t'aider à préparer ton ${event}. Donne-moi un budget ou un article précis et je chercherai dans le catalogue Warsha.`;

    return json({ reply, products: productOut, creators: creatorOut, plan: [], context: { intent: productOut.length ? "product_search" : "general", event, budget } });
  } catch (e) {
    console.error(e);
    return json({ error: "Assistant error" }, 500);
  }
});
