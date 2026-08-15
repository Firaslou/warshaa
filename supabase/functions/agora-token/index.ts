import { createClient } from "npm:@supabase/supabase-js@2.95.0";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appId = Deno.env.get("AGORA_APP_ID")?.trim();
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE")?.trim();
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Supabase configuration is incomplete", code: "MISSING_SUPABASE_CONFIG" }, 503);
    if (!appId) return json({ error: "AGORA_APP_ID is missing from the Edge Function secrets.", code: "MISSING_APP_ID" }, 503);
    if (!appCertificate) return json({ error: "AGORA_APP_CERTIFICATE is missing from the Edge Function secrets.", code: "MISSING_APP_CERTIFICATE" }, 503);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userRes?.user) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    const callerId = userRes.user.id;

    let body: { liveEventId?: unknown; channel?: unknown; uid?: unknown; role?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON request body.", code: "INVALID_JSON" }, 400); }

    const liveEventId = String(body.liveEventId ?? "").trim();
    const channel = String(body.channel ?? "").trim();
    if (!liveEventId || !/^[0-9a-f-]{36}$/i.test(liveEventId)) return json({ error: "A valid liveEventId is required.", code: "INVALID_LIVE_EVENT" }, 400);
    if (!channel || channel.length > 64) return json({ error: "Invalid Agora channel. It must contain 1–64 characters.", code: "INVALID_CHANNEL" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: liveEvent, error: liveError } = await admin
      .from("live_events")
      .select("id, startup_id, agora_channel, agora_uid, live_mode, status, startups!inner(owner_id)")
      .eq("id", liveEventId)
      .maybeSingle();

    if (liveError || !liveEvent) return json({ error: "Live event not found.", code: "LIVE_NOT_FOUND" }, 404);
    if (liveEvent.live_mode !== "agora") return json({ error: "This live does not use Agora.", code: "NOT_AGORA_LIVE" }, 409);
    if (liveEvent.agora_channel && liveEvent.agora_channel !== channel) return json({ error: "Channel does not belong to this live.", code: "CHANNEL_MISMATCH" }, 403);
    if (["ended", "cancelled"].includes(String(liveEvent.status))) return json({ error: "This live has ended.", code: "LIVE_ENDED" }, 409);

    const ownerId = (liveEvent.startups as any)?.owner_id;
    const requestedRole = body.role === "audience" ? "audience" : "host";
    if (requestedRole === "host" && callerId !== ownerId) return json({ error: "Only the live creator can receive a publisher token.", code: "NOT_OWNER" }, 403);

    const requestedUid = Number(body.uid ?? 0);
    const uid = Number.isFinite(requestedUid) && requestedUid > 0 ? Math.floor(requestedUid) : 0;
    if (!uid) return json({ error: "A valid uid is required.", code: "INVALID_UID" }, 400);

    const role = requestedRole === "audience" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
    const expiresInSeconds = 2 * 60 * 60;
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expiresInSeconds;

    const tokenValue = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channel,
      uid,
      role,
      privilegeExpiredTs,
      privilegeExpiredTs,
    );

    if (!tokenValue) return json({ error: "Agora token generation returned an empty token.", code: "EMPTY_TOKEN" }, 500);
    return json({ appId, channel, uid, token: tokenValue, expiresIn: expiresInSeconds });
  } catch (error) {
    console.error("Agora token unexpected error", error);
    return json({ error: "Unexpected error while creating the Agora token.", code: "TOKEN_FUNCTION_ERROR" }, 500);
  }
});
