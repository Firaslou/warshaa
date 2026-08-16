import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = String(Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "warsha.startups@gmail.com")
  .trim()
  .toLowerCase();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Service unavailable" }, 503);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResult, error: userError } = await userClient.auth.getUser(authHeader.slice(7));
    if (userError || !userResult.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (!(await consumeRateLimit(admin, userResult.user.id, "notify-admin", 5, 600))) {
      return json({ error: "Too many requests" }, 429);
    }

    const body = await req.json() as Record<string, unknown>;
    const type = String(body.type ?? "");

    if (type === "new-creator-application") {
      const applicationId = String(body.applicationId ?? "");
      if (!UUID_PATTERN.test(applicationId)) return json({ error: "Invalid application" }, 400);

      const { data: application, error } = await admin
        .from("startup_applications")
        .select("id,applicant_id,brand_name,city,category,description,whatsapp_number")
        .eq("id", applicationId)
        .eq("applicant_id", userResult.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!application) return json({ error: "Application not found" }, 404);

      const emailResult = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "new-creator-application",
          recipientEmail: ADMIN_EMAIL,
          idempotencyKey: `new-creator-application-${application.id}`,
          templateData: {
            brandName: application.brand_name,
            applicantEmail: userResult.user.email ?? "Inconnu",
            city: application.city,
            category: application.category,
            description: application.description,
            whatsapp: application.whatsapp_number,
          },
        },
      });
      if (emailResult.error || !emailResult.data?.success) throw new Error("Email delivery failed");
      return json({ success: true });
    }

    if (type === "new-reclamation") {
      const complaintId = String(body.complaintId ?? "");
      if (!UUID_PATTERN.test(complaintId)) return json({ error: "Invalid complaint" }, 400);

      const { data: complaint, error } = await admin
        .from("complaints")
        .select("id,reporter_id,startup_id,subject,message")
        .eq("id", complaintId)
        .eq("reporter_id", userResult.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!complaint) return json({ error: "Complaint not found" }, 404);

      const [{ data: profile }, { data: startup }] = await Promise.all([
        admin.from("profiles").select("full_name").eq("id", userResult.user.id).maybeSingle(),
        admin.from("startups").select("name").eq("id", complaint.startup_id).maybeSingle(),
      ]);
      const emailResult = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "new-reclamation",
          recipientEmail: ADMIN_EMAIL,
          idempotencyKey: `new-reclamation-${complaint.id}`,
          templateData: {
            userName: profile?.full_name || "Utilisateur Warsha",
            userEmail: userResult.user.email ?? "Inconnu",
            startupName: startup?.name || "Créateur inconnu",
            subject: complaint.subject,
            message: complaint.message,
          },
        },
      });
      if (emailResult.error || !emailResult.data?.success) throw new Error("Email delivery failed");
      return json({ success: true });
    }

    return json({ error: "Unknown notification type" }, 400);
  } catch (error) {
    console.error("notify-admin error", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Notification failed" }, 500);
  }
});
