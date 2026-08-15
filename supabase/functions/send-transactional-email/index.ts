import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const RESEND_API_URL = "https://api.resend.com/emails";
const ADMIN_EMAIL = "warsha.startups@gmail.com";
const ALLOWED_ADMIN_TEMPLATES = new Set(["complaint", "creator-application"]);

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlTemplate(templateName: string, data: Record<string, unknown>) {
  const brandName = escapeHtml(data.brandName);
  const subject = templateName === "creator-approved"
    ? "Votre demande de créateur Warsha a été approuvée"
    : templateName === "complaint"
      ? "Nouvelle réclamation sur Warsha"
      : "Nouvelle demande de créateur sur Warsha";
  const title = templateName === "creator-approved"
    ? "Demande de créateur approuvée"
    : templateName === "complaint"
      ? "Nouvelle réclamation"
      : "Nouvelle demande de créateur";
  const rows = Object.entries(data)
    .filter(([key]) => key !== "brandName" && key !== "startupSlug")
    .map(([key, value]) => `<p><strong>${escapeHtml(key)} :</strong> ${escapeHtml(value)}</p>`)
    .join("");
  return {
    subject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:680px;margin:auto"><h2>${title}</h2>${brandName ? `<p><strong>Warsha</strong> — ${brandName}</p>` : ""}${rows}<hr><p style="color:#777">Email automatique de Warsha.</p></div>`,
  };
}

async function sendEmail(apiKey: string, recipientEmail: string, templateName: string, templateData: Record<string, unknown>, idempotencyKey: string) {
  const template = htmlTemplate(templateName, templateData);
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: "Warsha <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: template.subject,
      html: template.html,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error("Email provider error");
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Supabase configuration is incomplete" }, 503);
    if (!apiKey) return json({ error: "RESEND_API_KEY is not configured" }, 503);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await callerClient.auth.getUser(token);
    const isServiceRole = token === serviceRoleKey;
    if (!isServiceRole && (userError || !userData.user)) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const templateName = String(body.templateName ?? "").trim();
    const requestedIdempotencyKey = body.idempotencyKey ? String(body.idempotencyKey).slice(0, 200) : undefined;

    if (templateName === "creator-approved") {
      if (!isServiceRole) return json({ error: "Forbidden" }, 403);
      const recipientEmail = String(body.recipientEmail ?? "").trim().toLowerCase();
      const templateData = (body.templateData && typeof body.templateData === "object") ? body.templateData as Record<string, unknown> : {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) || recipientEmail.length > 320) return json({ error: "Invalid recipient" }, 400);
      const result = await sendEmail(apiKey, recipientEmail, templateName, templateData, requestedIdempotencyKey || `creator-approved-${crypto.randomUUID()}`);
      return json({ success: true, id: result.id });
    }

    if (!ALLOWED_ADMIN_TEMPLATES.has(templateName)) return json({ error: "Forbidden template" }, 403);
    if (isServiceRole) {
      const templateData = (body.templateData && typeof body.templateData === "object") ? body.templateData as Record<string, unknown> : {};
      const result = await sendEmail(apiKey, ADMIN_EMAIL, templateName, templateData, requestedIdempotencyKey || `${templateName}-${crypto.randomUUID()}`);
      return json({ success: true, id: result.id, recipient: ADMIN_EMAIL });
    }

    // Browser callers cannot choose the recipient or email body. The message is
    // rebuilt from a real record created by the authenticated caller moments ago.
    const userId = userData.user.id;
    const db = createClient(supabaseUrl, serviceRoleKey);
    let templateData: Record<string, unknown>;
    let idempotencyKey: string;

    if (templateName === "complaint") {
      const { data: complaint, error } = await db
        .from("complaints")
        .select("id, reporter_id, subject, message, startup_id, startups(name)")
        .eq("reporter_id", userId)
        .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !complaint) return json({ error: "No recent complaint belongs to this user" }, 403);
      const startup = Array.isArray(complaint.startups) ? complaint.startups[0] : complaint.startups;
      templateData = {
        "Créateur concerné": (startup as any)?.name ?? "Créateur Warsha",
        "Sujet": complaint.subject,
        "Réclamation": complaint.message,
        "Email du demandeur": userData.user.email ?? "Non disponible",
      };
      idempotencyKey = `complaint-${complaint.id}`;
    } else {
      const { data: application, error } = await db
        .from("startup_applications")
        .select("id, applicant_id, brand_name, description, city, delegation, categories, category, whatsapp_number, instagram_url, facebook_url, tiktok_url")
        .eq("applicant_id", userId)
        .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !application) return json({ error: "No recent creator application belongs to this user" }, 403);
      templateData = {
        "Nom de la marque": application.brand_name,
        "Email du demandeur": userData.user.email ?? "Non disponible",
        "Ville": application.city,
        "Délégation": application.delegation || "Non renseignée",
        "Catégories": Array.isArray(application.categories) ? application.categories.join(", ") : application.category || "Non renseignées",
        "WhatsApp": application.whatsapp_number,
        "Description": application.description,
        "Instagram": application.instagram_url || "Non renseigné",
        "Facebook": application.facebook_url || "Non renseigné",
        "TikTok": application.tiktok_url || "Non renseigné",
      };
      idempotencyKey = `creator-application-${application.id}`;
    }

    const result = await sendEmail(apiKey, ADMIN_EMAIL, templateName, templateData, idempotencyKey);
    return json({ success: true, id: result.id, recipient: ADMIN_EMAIL });
  } catch (error) {
    console.error("send-transactional-email error", error);
    return json({ error: "Unexpected email error" }, 500);
  }
});
