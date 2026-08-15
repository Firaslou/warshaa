import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Mic, MicOff, Video, VideoOff, Radio, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AGORA_SDK_URL = "https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.24.2/AgoraRTC_N-production.min.js";
type Props = { liveEventId: string; channel: string; startupId: string; isHost: boolean; className?: string };
type LiveComment = { id: string; user_id: string | null; user_name: string; content: string; like_count: number; created_at: string };
let agoraPromise: Promise<any> | null = null;

function loadAgora() {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if ((window as any).AgoraRTC) return Promise.resolve((window as any).AgoraRTC);
  if (agoraPromise) return agoraPromise;
  agoraPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = AGORA_SDK_URL; script.async = true;
    script.onload = () => (window as any).AgoraRTC ? resolve((window as any).AgoraRTC) : reject(new Error("Agora SDK unavailable"));
    script.onerror = () => reject(new Error("Unable to load Agora SDK")); document.head.appendChild(script);
  });
  return agoraPromise;
}

export function AgoraLivePlayer({ liveEventId, channel, startupId: _startupId, isHost, className }: Props) {
  const localVideoRef = useRef<HTMLDivElement>(null); const remoteVideoRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<any[]>([]);
  const [status, setStatus] = useState<"loading" | "connected" | "failed">("loading"); const [micMuted, setMicMuted] = useState(false); const [cameraMuted, setCameraMuted] = useState(false);
  const [comments, setComments] = useState<LiveComment[]>([]); const [message, setMessage] = useState("");

  const getToken = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("agora-token", {
      body: { liveEventId, channel, role: isHost ? "host" : "audience" },
    });
    if (error) throw error;
    return data as { appId: string; token: string; uid: number; role: "host" | "audience" };
  }, [liveEventId, channel, isHost]);

  useEffect(() => {
    let cancelled = false; let client: any;
    const connect = async () => {
      try {
        const AgoraRTC = await loadAgora(); if (cancelled) return;
        const credentials = await getToken();
        if (credentials.role !== (isHost ? "host" : "audience")) throw new Error("Agora role mismatch");
        client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        await client.setClientRole(isHost ? "host" : "audience");
        client.on("user-published", async (user: any, mediaType: "audio" | "video") => {
          await client.subscribe(user, mediaType);
          if (mediaType === "video" && remoteVideoRef.current) user.videoTrack?.play(remoteVideoRef.current);
          if (mediaType === "audio") user.audioTrack?.play();
        });
        client.on("user-unpublished", () => { if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = ""; });
        await client.join(credentials.appId, channel, credentials.token || null, credentials.uid);
        if (isHost) {
          const tracks = await AgoraRTC.createMicrophoneAndCameraTracks({ encoderConfig: "music_standard" }, { encoderConfig: "720p_2" });
          tracksRef.current = tracks;
          tracks[1].play(localVideoRef.current!);
          await client.publish(tracks);
        }
        if (!cancelled) setStatus("connected");
      } catch (error) {
        console.error("Agora live error", error);
        if (!cancelled) { setStatus("failed"); toast.error("Impossible de rejoindre le live Agora. Vérifiez la configuration Agora."); }
      }
    };
    void connect();
    return () => {
      cancelled = true;
      tracksRef.current.forEach((track) => { try { track.stop(); track.close(); } catch { /* noop */ } });
      tracksRef.current = [];
      if (client) void client.leave().catch(() => undefined);
    };
  }, [channel, getToken, isHost]);

  useEffect(() => {
    const db = supabase as any;
    const loadComments = async () => {
      const { data } = await db.from("live_comments").select("id,user_id,user_name,content,like_count,created_at").eq("live_event_id", liveEventId).order("created_at", { ascending: true }).limit(200);
      if (data) setComments(data as LiveComment[]);
    };
    void loadComments();
    const channelRef = supabase.channel(`live-comments:${liveEventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_comments", filter: `live_event_id=eq.${liveEventId}` }, ({ new: row }) => setComments((prev) => [...prev, row as LiveComment]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_comments", filter: `live_event_id=eq.${liveEventId}` }, ({ new: row }) => setComments((prev) => prev.map((comment) => comment.id === row.id ? row as LiveComment : comment)))
      .subscribe();
    return () => { void supabase.removeChannel(channelRef); };
  }, [liveEventId]);

  const toggleMic = async () => { const track = tracksRef.current[0]; if (!track) return; const next = !micMuted; await track.setEnabled(!next); setMicMuted(next); };
  const toggleCamera = async () => { const track = tracksRef.current[1]; if (!track) return; const next = !cameraMuted; await track.setEnabled(!next); setCameraMuted(next); };
  const sendComment = async () => {
    const content = message.trim(); if (!content) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return toast.error("Connectez-vous pour commenter.");
    const { error } = await (supabase as any).from("live_comments").insert({ live_event_id: liveEventId, user_id: userData.user.id, user_name: userData.user.email?.split("@")[0] || "Visiteur", content });
    if (error) return toast.error(error.message); setMessage("");
  };
  const likeComment = async (comment: LiveComment) => { if (!isHost) return; await (supabase as any).from("live_comments").update({ like_count: comment.like_count + 1 }).eq("id", comment.id); };

  return <div className={cn("grid min-h-[520px] overflow-hidden rounded-3xl bg-zinc-950 text-white lg:grid-cols-[1fr_320px]", className)}>
    <div className="relative flex min-h-[420px] items-center justify-center bg-black"><div ref={isHost ? localVideoRef : remoteVideoRef} className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />
      {status === "loading" && <div className="relative z-10 flex flex-col items-center gap-3 text-sm text-white/70"><Loader2 className="h-7 w-7 animate-spin" />Connexion à Agora…</div>}
      {status === "failed" && <div className="relative z-10 rounded-2xl bg-red-500/15 p-5 text-center"><Radio className="mx-auto mb-2 h-7 w-7 text-red-400" /><p className="font-semibold">Live indisponible</p><p className="mt-1 text-xs text-white/60">Vérifiez l'App ID et le token Agora dans Supabase.</p></div>}
      {isHost && status === "connected" && <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2"><Button size="icon" variant="secondary" onClick={() => void toggleMic()} className="rounded-full">{micMuted ? <MicOff /> : <Mic />}</Button><Button size="icon" variant="secondary" onClick={() => void toggleCamera()} className="rounded-full">{cameraMuted ? <VideoOff /> : <Video />}</Button></div>}
    </div>
    <aside className="flex min-h-[360px] flex-col border-l border-white/10 bg-zinc-900"><div className="border-b border-white/10 p-4"><div className="flex items-center gap-2 font-semibold"><Radio className="h-4 w-4 text-primary" /> Chat Warsha</div><p className="mt-1 text-xs text-white/50">Les commentaires sont en temps réel.</p></div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">{comments.map((comment) => <div key={comment.id} className="rounded-xl bg-white/5 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-primary">{comment.user_name}</span>{isHost && <button type="button" onClick={() => void likeComment(comment)} className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-rose-400"><Heart className="h-3.5 w-3.5" />{comment.like_count || ""}</button>}</div><p className="mt-1 break-words text-xs text-white/90">{comment.content}</p></div>)}{comments.length === 0 && <p className="py-10 text-center text-xs text-white/40">Aucun commentaire pour le moment.</p>}</div>
      {!isHost && <div className="flex gap-2 border-t border-white/10 bg-zinc-950 p-3"><Input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void sendComment()} placeholder="Écrire un commentaire…" className="bg-zinc-800 text-white" /><Button size="icon" onClick={() => void sendComment()}><Send className="h-4 w-4" /></Button></div>}
    </aside>
  </div>;
}
