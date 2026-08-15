import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const ADMIN_EMAIL = "warsha.startups@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // This function is an internal server-to-server helper. Never expose the
    // service-role-backed email relay to browser callers.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    const bearer = authHeader?.replace(/^Bearer\s+/i, "");
    if (!serviceRoleKey || bearer !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const type = String(body?.type ?? "").trim();
    const data = body?.data;
    if (!["complaint", "creator-application"].includes(type) || !data || typeof data !== "object") {
      return new Response(JSON.stringify({ error: "Invalid notification payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("SUPABASE_URL is missing");
    const supabase = createClient(url, serviceRoleKey);

    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: type,
        recipientEmail: ADMIN_EMAIL,
        idempotencyKey: `${type}-${String((data as Record<string, unknown>).id ?? crypto.randomUUID()).slice(0, 200)}`,
        templateData: data,
      },
    });

    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-admin error", error);
    return new Response(JSON.stringify({ error: "Notification failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
