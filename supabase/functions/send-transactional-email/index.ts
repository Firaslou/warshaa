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
      : templateName === "creator-application"
        ? "Nouvelle demande de créateur sur Warsha"
        : "Notification Warsha";

  const title = templateName === "creator-approved"
    ? "Demande de créateur approuvée"
    : templateName === "complaint"
      ? "Nouvelle réclamation"
      : templateName === "creator-application"
        ? "Nouvelle demande de créateur"
        : "Notification";

  const rows = Object.entries(data)
    .filter(([key]) => key !== "brandName" && key !== "startupSlug")
    .map(([key, value]) => `<p><strong>${escapeHtml(key)} :</strong> ${escapeHtml(value)}</p>`)
    .join("");

  return {
    subject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:680px;margin:auto"><h2>${title}</h2>${brandName ? `<p><strong>Warsha</strong> — ${brandName}</p>` : ""}${rows}<hr><p style="color:#777">Email automatique de Warsha.</p></div>`,
  };
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
    const templateData = (body.templateData && typeof body.templateData === "object") ? body.templateData : {};
    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey).slice(0, 200) : undefined;

    if (templateName === "creator-approved") {
      // This template is only invoked internally by approve-creator-application
      // using the service-role client. It may send to the applicant's email.
      if (!isServiceRole) return json({ error: "Forbidden" }, 403);
      const recipientEmail = String(body.recipientEmail ?? "").trim().toLowerCase();
      if (!recipientEmail || recipientEmail.length > 320) return json({ error: "Invalid recipient" }, 400);
      const template = htmlTemplate(templateName, templateData);
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Warsha <onboarding@resend.dev>",
          to: [recipientEmail],
          subject: template.subject,
          html: template.html,
          ...(idempotencyKey ? { headers: { "X-Entity-Ref-ID": idempotencyKey } } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) return json({ error: "Email provider error" }, 502);
      return json({ success: true, id: result.id });
    }

    // Publicly callable admin notifications must always go to the Warsha admin mailbox.
    if (!ALLOWED_ADMIN_TEMPLATES.has(templateName)) return json({ error: "Forbidden template" }, 403);
    const template = htmlTemplate(templateName, templateData);
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Warsha <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: template.subject,
        html: template.html,
        ...(idempotencyKey ? { headers: { "X-Entity-Ref-ID": idempotencyKey } } : {}),
      }),
    });
    const result = await response.json();
    if (!response.ok) return json({ error: "Email provider error" }, 502);
    return json({ success: true, id: result.id, recipient: ADMIN_EMAIL });
  } catch (error) {
    console.error(error);
    return json({ error: "Unexpected email error" }, 500);
  }
});
