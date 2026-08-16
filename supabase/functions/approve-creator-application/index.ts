import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({ application_id: z.string().uuid() });

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || `creator-${Date.now()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: claimsErr } = await userClient.auth.getUser(token);
    if (claimsErr || !userRes?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const callerId = userRes.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (roleErr || !isAdmin) return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { application_id } = parsed.data;
    const { data: app, error: appErr } = await admin.from("startup_applications").select("*").eq("id", application_id).maybeSingle();
    if (appErr || !app) return new Response(JSON.stringify({ error: "Application not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (app.status === "approved") return new Response(JSON.stringify({ error: "Already approved" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const ownerId = app.applicant_id as string;
    const { data: ownerRes, error: userErr } = await admin.auth.admin.getUserById(ownerId);
    if (userErr || !ownerRes?.user) return new Response(JSON.stringify({ error: "Applicant user not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const recipientEmail = ownerRes.user.email;
    let baseSlug = slugify(app.brand_name);
    let slug = baseSlug;
    for (let i = 2; i < 50; i++) {
      const { data: existing } = await admin.from("startups").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${i}`;
    }
    const { data: existingStartup } = await admin.from("startups").select("id, slug").eq("owner_id", ownerId).maybeSingle();
    let startup = existingStartup;
    if (!existingStartup) {
      const { data: created, error: insErr } = await admin.from("startups").insert({
        owner_id: ownerId,
        slug,
        name: app.brand_name,
        description: app.description,
        city: app.city,
        delegation: app.delegation ?? null,
        category: app.category,
        whatsapp_number: app.whatsapp_number,
        instagram_url: app.instagram_url,
        facebook_url: app.facebook_url,
        tiktok_url: app.tiktok_url,
        latitude: app.latitude ?? null,
        longitude: app.longitude ?? null,
        creator_story: app.creator_story ?? null,
        status: "approved",
        badge: "verified",
      }).select("id, slug").single();
      if (insErr || !created) return new Response(JSON.stringify({ error: insErr?.message ?? "Failed to create startup" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      startup = created;
    } else {
      const { error: updateStartupError } = await admin.from("startups").update({ status: "approved", badge: "verified", city: app.city, delegation: app.delegation ?? null, latitude: app.latitude ?? null, longitude: app.longitude ?? null }).eq("id", existingStartup.id);
      if (updateStartupError) return new Response(JSON.stringify({ error: "Failed to update startup" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Grant the role only after the creator space exists. Every operation is
    // idempotent, so a failed final update can safely be retried by the admin.
    const { error: roleUpdateError } = await admin.from("user_roles").upsert(
      { user_id: ownerId, role: "startup" },
      { onConflict: "user_id,role" },
    );
    if (roleUpdateError) return new Response(JSON.stringify({ error: "Failed to grant creator role" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { error: applicationUpdateError } = await admin
      .from("startup_applications")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", application_id);
    if (applicationUpdateError) return new Response(JSON.stringify({ error: "Failed to finalize application" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (recipientEmail) {
      try {
        await admin.functions.invoke("send-transactional-email", { body: { templateName: "creator-approved", recipientEmail, idempotencyKey: `creator-approved-${application_id}`, templateData: { brandName: app.brand_name, startupSlug: startup!.slug } } });
      } catch (e) { console.warn("Email send failed:", e); }
    }
    return new Response(JSON.stringify({ success: true, startup_id: startup!.id, slug: startup!.slug }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Unexpected approval error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
