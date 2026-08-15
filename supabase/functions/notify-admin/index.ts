import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const ADMIN_EMAIL = "warsha.startups@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { type, data } = await req.json();
    if (!type || !data) throw new Error("type and data are required");

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, key);

    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: type === "complaint" ? "complaint" : "creator-application",
        recipientEmail: ADMIN_EMAIL,
        idempotencyKey: `${type}-${data.id ?? crypto.randomUUID()}`,
        templateData: data,
      },
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
