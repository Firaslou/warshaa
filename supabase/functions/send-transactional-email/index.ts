const RESEND_API_URL = "https://api.resend.com/emails";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Server-to-server only: browser sessions can never choose a recipient or body.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!serviceRoleKey || bearer !== serviceRoleKey) return json({ error: "Forbidden" }, 403);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ error: "Email service is unavailable" }, 503);

    const body = await req.json();
    if (body?.templateName !== "creator-approved") return json({ error: "Forbidden template" }, 403);

    const recipientEmail = String(body.recipientEmail ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) || recipientEmail.length > 320) {
      return json({ error: "Invalid recipient" }, 400);
    }

    const templateData = body.templateData && typeof body.templateData === "object"
      ? body.templateData as Record<string, unknown>
      : {};
    const brandName = escapeHtml(templateData.brandName);
    const startupSlug = encodeURIComponent(String(templateData.startupSlug ?? ""));
    const configuredSiteUrl = String(Deno.env.get("PUBLIC_SITE_URL") ?? "https://warshaa.firasloukil2016.workers.dev").replace(/\/$/, "");
    const siteUrl = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configuredSiteUrl)
      ? configuredSiteUrl
      : "https://warshaa.firasloukil2016.workers.dev";
    const idempotencyKey = String(body.idempotencyKey ?? crypto.randomUUID())
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 180);
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: "Warsha <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: "Votre demande de créateur Warsha a été approuvée",
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:680px;margin:auto"><h2>Demande de créateur approuvée</h2><p>Votre espace ${brandName || "Warsha"} est maintenant approuvé.</p>${startupSlug ? `<p><a href="${siteUrl}/startup/${startupSlug}">Voir votre espace</a></p>` : ""}<hr><p style="color:#777">Email automatique de Warsha.</p></div>`,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error("Email provider error");
    return json({ success: true, id: result.id });
  } catch (error) {
    console.error("send-transactional-email error", error);
    return json({ error: "Unexpected email error" }, 500);
  }
});
