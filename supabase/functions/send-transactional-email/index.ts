const RESEND_API_URL = "https://api.resend.com/emails";
const ADMIN_TEMPLATES = new Set(["new-creator-application", "new-reclamation"]);
const ALLOWED_TEMPLATES = new Set(["creator-approved", ...ADMIN_TEMPLATES]);

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

function cleanSubject(value: unknown, fallback: string) {
  return String(value ?? fallback).replace(/[\r\n]+/g, " ").trim().slice(0, 140) || fallback;
}

function buildEmail(templateName: string, data: Record<string, unknown>, siteUrl: string) {
  if (templateName === "creator-approved") {
    const brandName = escapeHtml(data.brandName) || "Warsha";
    const startupSlug = encodeURIComponent(String(data.startupSlug ?? ""));
    return {
      subject: "Votre demande de créateur Warsha a été approuvée",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:680px;margin:auto"><h2>Demande de créateur approuvée</h2><p>Votre espace ${brandName} est maintenant approuvé.</p>${startupSlug ? `<p><a href="${siteUrl}/startup/${startupSlug}">Voir votre espace</a></p>` : ""}<hr><p style="color:#777">Email automatique de Warsha.</p></div>`,
    };
  }

  if (templateName === "new-creator-application") {
    const brandName = escapeHtml(data.brandName);
    return {
      subject: `Nouvelle demande créateur : ${cleanSubject(data.brandName, "Marque inconnue")}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:680px;margin:auto"><h2>Nouvelle demande de créateur</h2><table style="border-collapse:collapse;width:100%"><tr><td><strong>Marque</strong></td><td>${brandName}</td></tr><tr><td><strong>Email</strong></td><td>${escapeHtml(data.applicantEmail)}</td></tr><tr><td><strong>Ville</strong></td><td>${escapeHtml(data.city)}</td></tr><tr><td><strong>Catégorie</strong></td><td>${escapeHtml(data.category)}</td></tr><tr><td><strong>WhatsApp</strong></td><td>${escapeHtml(data.whatsapp)}</td></tr></table><p>${escapeHtml(String(data.description ?? "").slice(0, 500))}</p><p><a href="${siteUrl}/admin">Examiner la candidature</a></p><hr><p style="color:#777">Email automatique de Warsha.</p></div>`,
    };
  }

  return {
    subject: `Nouvelle réclamation : ${cleanSubject(data.subject, "Sans objet")}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:680px;margin:auto"><h2>Nouvelle réclamation</h2><table style="border-collapse:collapse;width:100%"><tr><td><strong>Utilisateur</strong></td><td>${escapeHtml(data.userName)} (${escapeHtml(data.userEmail)})</td></tr><tr><td><strong>Créateur signalé</strong></td><td>${escapeHtml(data.startupName)}</td></tr><tr><td><strong>Objet</strong></td><td>${escapeHtml(data.subject)}</td></tr></table><div style="margin-top:16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap">${escapeHtml(String(data.message ?? "").slice(0, 2000))}</div><p><a href="${siteUrl}/admin">Ouvrir le panneau administrateur</a></p><hr><p style="color:#777">Email automatique de Warsha.</p></div>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Only another trusted Edge Function holding the service-role key may call this relay.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!serviceRoleKey || bearer !== serviceRoleKey) return json({ error: "Forbidden" }, 403);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ error: "Email service is unavailable" }, 503);

    const body = await req.json() as Record<string, unknown>;
    const templateName = String(body.templateName ?? "");
    if (!ALLOWED_TEMPLATES.has(templateName)) return json({ error: "Forbidden template" }, 403);

    const recipientEmail = String(body.recipientEmail ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) || recipientEmail.length > 320) {
      return json({ error: "Invalid recipient" }, 400);
    }
    const adminEmail = String(Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "warsha.startups@gmail.com").trim().toLowerCase();
    if (ADMIN_TEMPLATES.has(templateName) && recipientEmail !== adminEmail) {
      return json({ error: "Forbidden recipient" }, 403);
    }

    const templateData = body.templateData && typeof body.templateData === "object"
      ? body.templateData as Record<string, unknown>
      : {};
    const configuredSiteUrl = String(Deno.env.get("PUBLIC_SITE_URL") ?? "https://warshaa.firasloukil2016.workers.dev").replace(/\/$/, "");
    const siteUrl = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configuredSiteUrl)
      ? configuredSiteUrl
      : "https://warshaa.firasloukil2016.workers.dev";
    const email = buildEmail(templateName, templateData, siteUrl);
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
        from: String(Deno.env.get("EMAIL_FROM") ?? "Warsha <onboarding@resend.dev>"),
        to: [recipientEmail],
        subject: email.subject,
        html: email.html,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Email provider rejected request", response.status);
      return json({ error: "Email provider error" }, 502);
    }
    return json({ success: true, id: result.id });
  } catch (error) {
    console.error("send-transactional-email error", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Unexpected email error" }, 500);
  }
});
