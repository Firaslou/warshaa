import { RtcTokenBuilder, RtcRole } from "https://esm.sh/agora-access-token@2.0.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const appId = Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");
    if (!appId || !appCertificate) {
      return new Response(JSON.stringify({ error: "Agora is not configured on the server." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const channel = String(body.channel || "").trim();
    const uid = Number(body.uid || 0);
    const role = body.role === "audience" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    if (!channel || channel.length > 64) {
      return new Response(JSON.stringify({ error: "Invalid channel." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numericUid = Number.isFinite(uid) && uid > 0 ? uid : 0;
    const expiresInSeconds = 2 * 60 * 60;
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channel,
      numericUid,
      role,
      privilegeExpiredTs,
      privilegeExpiredTs,
    );

    return new Response(JSON.stringify({ appId, channel, uid: numericUid, token, expiresIn: expiresInSeconds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Agora token error", error);
    return new Response(JSON.stringify({ error: "Unable to create Agora token." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
