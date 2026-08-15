import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const RESEND_API_URL = "https://api.resend.com/emails";
const ADMIN_EMAIL = "warsha.startups@gmail.com";

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

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

    const body = await req.json();
    const { templateName, recipientEmail, idempotencyKey, templateData = {} } = body;

    if (!templateName || !recipientEmail) {
      return new Response(JSON.stringify({ error: "templateName and recipientEmail are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = htmlTemplate(templateName, templateData);
    const payload: Record<string, unknown> = {
      from: "Warsha <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: template.subject,
      html: template.html,
    };

    if (idempotencyKey) payload.headers = { "X-Entity-Ref-ID": idempotencyKey };

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Resend error", result);
      return new Response(JSON.stringify({ error: "Email provider error", details: result }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id, recipient: ADMIN_EMAIL }), {
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
