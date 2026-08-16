import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Require a shared secret so only the scheduler/admin can trigger this job
    const expected = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    // All approved startups with at least one product
    const { data: startups, error } = await admin
      .from("startups")
      .select("id, owner_id, name, slug, products(id)")
      .eq("status", "approved");

    if (error) throw error;

    // For each owner, only notify if no stock_reminder was sent in the last 14 days
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const candidates = (startups ?? []).filter((s: any) => (s.products?.length ?? 0) > 0);

    const rows: any[] = [];
    for (const s of candidates) {
      const { data: recent } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", s.owner_id)
        .eq("type", "stock_reminder")
        .gte("created_at", cutoff)
        .limit(1)
        .maybeSingle();
      if (recent) continue;
      rows.push({
        user_id: s.owner_id,
        type: "stock_reminder",
        title: "Mettez à jour votre stock",
        body: `Bonjour ${s.name}, pensez à vérifier la disponibilité de vos produits pour rassurer vos clients.`,
        link: `/creator`,
      });
    }

    let inserted = 0;
    if (rows.length > 0) {
      const { error: insErr, count } = await admin
        .from("notifications")
        .insert(rows, { count: "exact" });
      if (insErr) throw insErr;
      inserted = count ?? rows.length;
    }

    return new Response(JSON.stringify({ success: true, inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Unexpected reminder error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
