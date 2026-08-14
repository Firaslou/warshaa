import { RtcTokenBuilder, RtcRole } from "https://esm.sh/agora-token@2.0.5";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const appId = Deno.env.get("AGORA_APP_ID")?.trim();
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE")?.trim();

    if (!appId) {
      console.error("Agora token: AGORA_APP_ID is missing");
      return json({ error: "AGORA_APP_ID is missing from the Edge Function secrets.", code: "MISSING_APP_ID" }, 503);
    }

    if (!appCertificate) {
      console.error("Agora token: AGORA_APP_CERTIFICATE is missing");
      return json({ error: "AGORA_APP_CERTIFICATE is missing from the Edge Function secrets.", code: "MISSING_APP_CERTIFICATE" }, 503);
    }

    let body: { channel?: unknown; uid?: unknown; role?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON request body.", code: "INVALID_JSON" }, 400);
    }

    const channel = String(body.channel ?? "").trim();
    if (!channel || channel.length > 64) {
      return json({ error: "Invalid Agora channel. It must contain 1–64 characters.", code: "INVALID_CHANNEL" }, 400);
    }

    const requestedUid = Number(body.uid ?? 0);
    const uid = Number.isFinite(requestedUid) && requestedUid > 0 ? Math.floor(requestedUid) : 0;
    const role = body.role === "audience" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
    const expiresInSeconds = 2 * 60 * 60;
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expiresInSeconds;

    let token: string;
    try {
      token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channel,
        uid,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs,
      );
    } catch (error) {
      console.error("Agora token generation failed", error);
      return json({ error: "Agora rejected the App ID/App Certificate while generating the token.", code: "TOKEN_GENERATION_FAILED" }, 500);
    }

    if (!token) {
      console.error("Agora token generation returned an empty token");
      return json({ error: "Agora token generation returned an empty token.", code: "EMPTY_TOKEN" }, 500);
    }

    return json({ appId, channel, uid, token, expiresIn: expiresInSeconds });
  } catch (error) {
    console.error("Agora token unexpected error", error);
    return json({ error: "Unexpected error while creating the Agora token.", code: "TOKEN_FUNCTION_ERROR" }, 500);
  }
});
