import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X, Heart, Sparkles, Send, MessageCircle, Eye, ShoppingBag, Pause, Play, Mic, MicOff, Video, VideoOff, CheckCircle2, RotateCcw, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LiveMessage { id: string; user_id: string; user_name: string; avatar_url?: string | null; content: string; created_at: string; }
interface FloatingReaction { id: string; emoji: string; left: number; }
interface PinnedProduct { id: string; name: string; price: number | null; discount_percentage?: number | null; currency: string; images: string[]; description?: string | null; startup_id?: string; whatsapp_number?: string | null; }
interface LiveRoomModalProps { open: boolean; onOpenChange: (open: boolean) => void; liveEventId: string; startupId: string; startupName: string; startupSlug: string; startupLogo?: string | null; isCreator?: boolean; initialStreamUrl?: string | null; }

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  ...(import.meta.env.VITE_TURN_URL && import.meta.env.VITE_TURN_USERNAME && import.meta.env.VITE_TURN_CREDENTIAL ? [{ urls: import.meta.env.VITE_TURN_URL as string, username: import.meta.env.VITE_TURN_USERNAME as string, credential: import.meta.env.VITE_TURN_CREDENTIAL as string }] : []),
];
const RTC_CONFIG: RTCConfiguration = { iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 };
const RECORDING_BUCKET = "live-recordings";

function getRecordingMimeType() {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function LiveRoomModal({ open, onOpenChange, liveEventId, startupId, startupName, startupSlug, startupLogo, isCreator = false, initialStreamUrl }: LiveRoomModalProps) {
  const { user } = useAuth();
  const { isStartupFavorite, toggleStartupFavorite } = useFavorites();
  const [liveStatus, setLiveStatus] = useState<"live" | "paused" | "ended">("live");
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [viewerCount, setViewerCount] = useState(1);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [pinnedProduct, setPinnedProduct] = useState<PinnedProduct | null>(null);
  const [creatorProducts, setCreatorProducts] = useState<PinnedProduct[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUploading, setRecordingUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStopPromiseRef = useRef<Promise<string | null> | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const viewerIdRef = useRef(Math.random().toString(36).slice(2, 12));
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCreatorCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingViewerCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const channelRef = useRef<any>(null);
  const channelReadyRef = useRef(false);
  const viewerJoinInFlightRef = useRef(false);
  const viewerMutedRef = useRef(true);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "failed">("connecting");
  const [viewerMuted, setViewerMuted] = useState(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const uploadRecording = useCallback(async (): Promise<string | null> => {
    const chunks = recordingChunksRef.current.splice(0);
    if (!chunks.length || !user?.id) return null;
    setRecordingUploading(true);
    try {
      const mimeType = recorderRef.current?.mimeType || "video/webm";
      const blob = new Blob(chunks, { type: mimeType });
      if (!blob.size) return null;
      const extension = "webm";
      const path = `${startupId}/${liveEventId}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(RECORDING_BUCKET).upload(path, blob, { contentType: mimeType, upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(RECORDING_BUCKET).getPublicUrl(path);
      const recordingUrl = data.publicUrl;
      const { error: updateError } = await (supabase.from("live_events" as any) as any).update({ recording_url: recordingUrl }).eq("id", liveEventId);
      if (updateError) throw updateError;
      toast.success("L'enregistrement du live est disponible dans l'historique.");
      return recordingUrl;
    } catch (error) {
      console.error("Live recording upload failed:", error);
      toast.error("Le live est terminé, mais l'enregistrement n'a pas pu être sauvegardé.");
      return null;
    } finally {
      setRecordingUploading(false);
    }
  }, [liveEventId, startupId, user?.id]);

  const startRecording = useCallback((stream: MediaStream) => {
    if (!isCreator || recorderRef.current || typeof MediaRecorder === "undefined") return;
    const mimeType = getRecordingMimeType();
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 900_000, audioBitsPerSecond: 64_000 } : undefined);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data && event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onerror = (event) => console.error("MediaRecorder error:", event);
      recorder.onstop = () => { setIsRecording(false); };
      recorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      console.error("Could not start live recording:", error);
      toast.error("L'enregistrement automatique n'a pas pu démarrer.");
    }
  }, [isCreator]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    if (recordingStopPromiseRef.current) return recordingStopPromiseRef.current;
    recordingStopPromiseRef.current = new Promise<string | null>((resolve) => {
      const finish = async () => {
        recorderRef.current = null;
        const url = await uploadRecording();
        recordingStopPromiseRef.current = null;
        resolve(url);
      };
      recorder.addEventListener("stop", () => { void finish(); }, { once: true });
      if (recorder.state !== "inactive") recorder.stop(); else void finish();
    });
    return recordingStopPromiseRef.current;
  }, [uploadRecording]);

  const sendViewerJoin = useCallback(() => {
    if (isCreator || !channelRef.current || !channelReadyRef.current || viewerJoinInFlightRef.current) return;
    viewerJoinInFlightRef.current = true;
    setConnectionStatus("connecting");
    void channelRef.current.send({ type: "broadcast", event: "webrtc_viewer_join", payload: { viewerId: viewerIdRef.current } });
    window.setTimeout(() => { viewerJoinInFlightRef.current = false; }, 1000);
  }, [isCreator]);

  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia unsupported");
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mediaStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; await videoRef.current.play().catch(() => undefined); }
      for (const pc of peerConnectionsRef.current.values()) {
        for (const track of stream.getTracks()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
          if (sender) await sender.replaceTrack(track).catch(() => undefined); else if (pc.connectionState !== "closed") pc.addTrack(track, stream);
        }
      }
      if (!recorderRef.current) startRecording(stream);
      if (channelRef.current && channelReadyRef.current) await channelRef.current.send({ type: "broadcast", event: "webrtc_stream_ready", payload: { creatorId: user?.id ?? null } });
    } catch (error) {
      console.error("Unable to start camera:", error);
      toast.error("Impossible d'accéder à la caméra et au microphone. Vérifiez les autorisations du navigateur.");
    }
  }, [facingMode, startRecording, user?.id]);

  useEffect(() => {
    if (!open || !startupId) return;
    void (async () => {
      const { data } = await supabase.from("products").select("id, name, price, discount_percentage, currency, images, description, startup_id").eq("startup_id", startupId).eq("is_published", true).limit(20);
      if (data) { setCreatorProducts(data as PinnedProduct[]); if (data.length && !pinnedProduct) setPinnedProduct(data[0] as PinnedProduct); }
    })();
  }, [open, startupId]);

  useEffect(() => {
    if (!open || !liveEventId) return;
    const channel = supabase.channel(`live_room:${liveEventId}`, { config: { presence: { key: user?.id || `anon-${Math.random().toString(36).slice(2, 7)}` } } });
    channelRef.current = channel; channelReadyRef.current = false; viewerJoinInFlightRef.current = false;

    const createCreatorPeer = async (viewerId: string) => {
      const stream = mediaStreamRef.current;
      if (!isCreator || !stream || !channelReadyRef.current || !viewerId) return;
      peerConnectionsRef.current.get(viewerId)?.close();
      pendingCreatorCandidatesRef.current.delete(viewerId);
      const pc = new RTCPeerConnection(RTC_CONFIG); peerConnectionsRef.current.set(viewerId, pc);
      pc.onicecandidate = (event) => { if (event.candidate && channelRef.current && channelReadyRef.current) void channelRef.current.send({ type: "broadcast", event: "webrtc_ice_candidate", payload: { viewerId, candidate: event.candidate.toJSON(), from: "creator" } }); };
      pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState) && peerConnectionsRef.current.get(viewerId) === pc) peerConnectionsRef.current.delete(viewerId); };
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); if (channelRef.current && channelReadyRef.current) await channelRef.current.send({ type: "broadcast", event: "webrtc_offer", payload: { viewerId, offer: pc.localDescription?.toJSON() ?? offer } }); }
      catch (error) { console.error("WebRTC offer failed:", error); pc.close(); peerConnectionsRef.current.delete(viewerId); }
    };

    const setupViewerPeer = async (offer: RTCSessionDescriptionInit, viewerId: string) => {
      if (isCreator || viewerId !== viewerIdRef.current) return;
      viewerPcRef.current?.close(); const pc = new RTCPeerConnection(RTC_CONFIG); viewerPcRef.current = pc; setConnectionStatus("connecting");
      pc.onconnectionstatechange = () => { if (pc.connectionState === "connected") setConnectionStatus("connected"); else if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setConnectionStatus("failed"); };
      pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === "failed") setConnectionStatus("failed"); };
      pc.onicecandidate = (event) => { if (event.candidate && channelRef.current && channelReadyRef.current) void channelRef.current.send({ type: "broadcast", event: "webrtc_ice_candidate", payload: { viewerId: viewerIdRef.current, candidate: event.candidate.toJSON(), from: "viewer" } }); };
      pc.ontrack = (event) => { const video = viewerVideoRef.current; if (!video) return; video.srcObject = event.streams[0] ?? new MediaStream([event.track]); video.muted = viewerMutedRef.current; void video.play().catch(() => { viewerMutedRef.current = true; setViewerMuted(true); video.muted = true; void video.play().catch(() => undefined); }); };
      try { await pc.setRemoteDescription(new RTCSessionDescription(offer)); for (const candidate of pendingViewerCandidatesRef.current.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); if (channelRef.current && channelReadyRef.current) await channelRef.current.send({ type: "broadcast", event: "webrtc_answer", payload: { viewerId: viewerIdRef.current, answer: pc.localDescription?.toJSON() ?? answer } }); }
      catch (error) { console.error("Viewer WebRTC negotiation failed:", error); setConnectionStatus("failed"); }
    };

    channel
      .on("presence", { event: "sync" }, () => setViewerCount(Math.max(1, Object.keys(channel.presenceState()).length)))
      .on("broadcast", { event: "chat_message" }, ({ payload }) => { if (payload) setMessages((prev) => [...prev, payload]); })
      .on("broadcast", { event: "reaction" }, ({ payload }) => { if (payload?.emoji) triggerReaction(payload.emoji, false); })
      .on("broadcast", { event: "status_change" }, ({ payload }) => { if (payload?.status) setLiveStatus(payload.status); })
      .on("broadcast", { event: "pin_product" }, ({ payload }) => { if (payload?.product) setPinnedProduct(payload.product); })
      .on("broadcast", { event: "webrtc_stream_ready" }, () => { if (!isCreator && !viewerPcRef.current) sendViewerJoin(); })
      .on("broadcast", { event: "webrtc_viewer_join" }, ({ payload }) => { if (isCreator && payload?.viewerId) void createCreatorPeer(payload.viewerId); })
      .on("broadcast", { event: "webrtc_offer" }, ({ payload }) => { if (payload?.viewerId && payload?.offer) void setupViewerPeer(payload.offer, payload.viewerId); })
      .on("broadcast", { event: "webrtc_answer" }, async ({ payload }) => {
        if (!isCreator || !payload?.viewerId || !payload?.answer) return; const pc = peerConnectionsRef.current.get(payload.viewerId); if (!pc) return;
        try { await pc.setRemoteDescription(new RTCSessionDescription(payload.answer)); for (const candidate of pendingCreatorCandidatesRef.current.get(payload.viewerId) ?? []) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined); pendingCreatorCandidatesRef.current.delete(payload.viewerId); } catch (error) { console.error("WebRTC answer failed:", error); }
      })
      .on("broadcast", { event: "webrtc_ice_candidate" }, async ({ payload }) => {
        if (!payload?.candidate || !payload?.viewerId || !payload?.from) return;
        if (isCreator && payload.from === "viewer") { const pc = peerConnectionsRef.current.get(payload.viewerId); if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => undefined); else { const queued = pendingCreatorCandidatesRef.current.get(payload.viewerId) ?? []; queued.push(payload.candidate); pendingCreatorCandidatesRef.current.set(payload.viewerId, queued); } }
        else if (!isCreator && payload.from === "creator" && payload.viewerId === viewerIdRef.current) { const pc = viewerPcRef.current; if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => undefined); else pendingViewerCandidatesRef.current.push(payload.candidate); }
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        channelReadyRef.current = true;
        await channel.track({ userId: user?.id, userName: user?.email?.split("@")[0] || "Spectateur", isCreator, joinedAt: new Date().toISOString() });
        if (isCreator) await startCamera(); else sendViewerJoin();
      });

    return () => {
      channelReadyRef.current = false; channelRef.current = null; viewerJoinInFlightRef.current = false; channel.unsubscribe(); void supabase.removeChannel(channel);
      peerConnectionsRef.current.forEach((pc) => pc.close()); peerConnectionsRef.current.clear(); pendingCreatorCandidatesRef.current.clear(); viewerPcRef.current?.close(); viewerPcRef.current = null; pendingViewerCandidatesRef.current = [];
      if (!isCreator) mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [open, liveEventId, user, isCreator, sendViewerJoin, startCamera]);

  useEffect(() => { chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const triggerReaction = (emoji: string, broadcast = true) => { const id = `${Date.now()}-${Math.random()}`; setReactions((prev) => [...prev, { id, emoji, left: Math.floor(Math.random() * 60) + 20 }]); window.setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2200); if (broadcast && channelRef.current && channelReadyRef.current) void channelRef.current.send({ type: "broadcast", event: "reaction", payload: { emoji } }); };
  const handleSendMessage = () => { const text = inputMessage.trim(); if (!text) return; const msg: LiveMessage = { id: `${Date.now()}-${Math.random()}`, user_id: user?.id || "anon", user_name: user?.email?.split("@")[0] || "Visiteur", content: text, created_at: new Date().toISOString() }; setMessages((prev) => [...prev, msg]); setInputMessage(""); if (channelRef.current && channelReadyRef.current) void channelRef.current.send({ type: "broadcast", event: "chat_message", payload: msg }); };
  const togglePauseLive = () => { const next = liveStatus === "live" ? "paused" : "live"; setLiveStatus(next); mediaStreamRef.current?.getVideoTracks().forEach((track) => (track.enabled = next === "live")); mediaStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = next === "live" && !isAudioMuted)); if (channelRef.current && channelReadyRef.current) void channelRef.current.send({ type: "broadcast", event: "status_change", payload: { status: next } }); };
  const toggleMuteAudio = () => { const stream = mediaStreamRef.current; if (!stream) return; const next = !isAudioMuted; stream.getAudioTracks().forEach((track) => (track.enabled = !next)); setIsAudioMuted(next); };
  const toggleMuteVideo = () => { const stream = mediaStreamRef.current; if (!stream) return; const next = !isVideoMuted; stream.getVideoTracks().forEach((track) => (track.enabled = !next)); setIsVideoMuted(next); };
  const handleSwitchCamera = () => { const next = facingMode === "user" ? "environment" : "user"; setFacingMode(next); void startCamera(next); };
  const handlePinProduct = (product: PinnedProduct) => { setPinnedProduct(product); setShowProductPicker(false); if (channelRef.current && channelReadyRef.current) void channelRef.current.send({ type: "broadcast", event: "pin_product", payload: { product } }); };
  const requestViewerStream = () => { if (isCreator) return; viewerPcRef.current?.close(); viewerPcRef.current = null; pendingViewerCandidatesRef.current = []; viewerJoinInFlightRef.current = false; setConnectionStatus("connecting"); sendViewerJoin(); };
  const enableViewerSound = async () => { const video = viewerVideoRef.current; if (!video) return; video.muted = false; try { await video.play(); viewerMutedRef.current = false; setViewerMuted(false); } catch { video.muted = true; setViewerMuted(true); toast.error("Le navigateur a bloqué le son. Touchez de nouveau le bouton."); } };

  const handleEndLive = async () => {
    if (!confirm("Voulez-vous vraiment terminer ce live pour tous les spectateurs ?")) return;
    if (isCreator) await stopRecording();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop()); mediaStreamRef.current = null; setLiveStatus("ended");
    await Promise.all([
      supabase.from("live_events").update({ status: "ended", updated_at: new Date().toISOString() }).eq("id", liveEventId),
      supabase.from("startups").update({ is_live: false, live_started_at: null }).eq("id", startupId),
    ]);
    if (channelRef.current && channelReadyRef.current) void channelRef.current.send({ type: "broadcast", event: "status_change", payload: { status: "ended" } });
    toast.success("Live terminé avec succès !"); onOpenChange(false);
  };

  const handleCancelLive = async () => {
    if (!confirm("Annuler et supprimer ce live ?")) return;
    if (isCreator && recorderRef.current) { recorderRef.current.stop(); recorderRef.current = null; recordingChunksRef.current = []; }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop()); mediaStreamRef.current = null;
    await Promise.all([
      supabase.from("live_events").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", liveEventId),
      supabase.from("startups").update({ is_live: false, live_started_at: null }).eq("id", startupId),
    ]);
    toast.info("Live annulé."); onOpenChange(false);
  };

  const isFav = isStartupFavorite(startupId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] max-h-[720px] p-0 overflow-hidden rounded-3xl border-border/70 bg-black text-white shadow-2xl flex flex-col md:flex-row">
        <div className="relative flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
          <div className="relative z-20 flex items-center justify-between p-3.5 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-2.5"><Link to={`/startup/${startupSlug}`} className="flex items-center gap-2 rounded-full bg-black/50 pr-3 p-1 border border-white/15">{startupLogo ? <img src={startupLogo} alt={startupName} className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold">{startupName.charAt(0)}</div>}<span className="text-xs font-semibold truncate max-w-[120px]">{startupName}</span></Link>{liveStatus === "live" ? <div className="rounded-full bg-destructive px-2.5 py-1 text-[10px] font-extrabold uppercase animate-pulse">● En direct</div> : liveStatus === "paused" ? <div className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-black uppercase">Pause</div> : <div className="rounded-full bg-zinc-600 px-2.5 py-1 text-[10px] font-bold uppercase">Terminé</div>}<div className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px]"><Eye className="h-3.5 w-3.5 text-rose-400" />{viewerCount}</div>{isCreator && isRecording && <div className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold"><Circle className="h-2.5 w-2.5 fill-red-500 text-red-500 animate-pulse" />REC</div>}</div>
            <div className="flex items-center gap-1.5"><Button size="sm" variant="ghost" onClick={() => void toggleStartupFavorite(startupId)} className={cn("h-8 rounded-full px-2.5 text-xs", isFav ? "text-rose-500" : "text-white/80")}><Heart className={cn("h-4 w-4 mr-1", isFav && "fill-rose-500")} />{isFav ? "Abonné" : "Suivre"}</Button><Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} className="h-8 w-8 rounded-full"><X className="h-4 w-4" /></Button></div>
          </div>

          <div className="absolute inset-0 z-0 flex items-center justify-center bg-zinc-950">
            {isCreator ? <video ref={videoRef} autoPlay playsInline muted className={cn("h-full w-full object-cover", facingMode === "user" && "scale-x-[-1]", isVideoMuted && "hidden")} /> : initialStreamUrl ? <iframe src={initialStreamUrl} title="Live stream" className="h-full w-full border-0" allow="autoplay; camera; microphone; fullscreen" /> : <video ref={viewerVideoRef} autoPlay playsInline muted={viewerMuted} className="h-full w-full object-cover bg-black" />}
            {!isCreator && !initialStreamUrl && liveStatus !== "ended" && <div className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 gap-2">{viewerMuted && <Button size="sm" onClick={() => void enableViewerSound()} className="rounded-full bg-white text-black"><Mic className="mr-2 h-4 w-4" />Activer le son</Button>}{connectionStatus !== "connected" && <Button size="sm" variant="secondary" onClick={requestViewerStream} className="rounded-full"><RotateCcw className="mr-2 h-4 w-4" />{connectionStatus === "failed" ? "Reconnecter" : "Charger le direct"}</Button>}</div>}
            {liveStatus === "paused" && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 text-center"><Pause className="mb-3 h-8 w-8 text-amber-400" /><h4 className="font-serif text-lg font-bold">Le direct est en pause</h4></div>}
            {liveStatus === "ended" && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/85 p-6 text-center"><CheckCircle2 className="mb-3 h-8 w-8 text-primary" /><h4 className="font-serif text-xl font-bold">Ce live est terminé</h4><Button asChild className="mt-4 rounded-2xl"><Link to={`/startup/${startupSlug}`}>Voir la boutique</Link></Button></div>}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-24 top-16 z-10 overflow-hidden">{reactions.map((r) => <div key={r.id} style={{ left: `${r.left}%` }} className="absolute bottom-2 text-3xl animate-floating-heart">{r.emoji}</div>)}</div>
          {pinnedProduct && liveStatus !== "ended" && <div className="relative z-20 m-3 max-w-[280px] rounded-2xl border border-white/20 bg-black/70 p-2.5 backdrop-blur-md"><div className="flex items-center gap-2.5"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-800">{pinnedProduct.images?.[0] ? <img src={pinnedProduct.images[0]} alt={pinnedProduct.name} className="h-full w-full object-cover" /> : <ShoppingBag className="m-auto mt-3 h-6 w-6 text-white/40" />}</div><div className="min-w-0 flex-1"><Badge variant="outline" className="h-4 px-1 text-[9px] border-primary text-primary">En direct</Badge><p className="truncate text-xs font-semibold mt-0.5">{pinnedProduct.name}</p>{pinnedProduct.price != null && <p className="text-xs font-bold text-primary">{Number(pinnedProduct.price).toFixed(3)} {pinnedProduct.currency || "TND"}</p>}</div><Button size="sm" className="h-8 rounded-xl text-xs" onClick={() => openWhatsApp({ phone: pinnedProduct.whatsapp_number || "+21620000000", productName: pinnedProduct.name, startupId, productId: pinnedProduct.id, message: `Bonjour, j'ai vu votre produit "${pinnedProduct.name}" pendant votre LIVE sur Warsha !` })}>Acheter</Button></div></div>}

          {isCreator && <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-t from-black/90 to-transparent"><div className="flex items-center gap-1.5"><Button size="sm" variant="outline" onClick={togglePauseLive} className="h-8 rounded-xl text-xs">{liveStatus === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</Button><Button size="icon" variant="outline" onClick={toggleMuteAudio} className="h-8 w-8 rounded-xl">{isAudioMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}</Button><Button size="icon" variant="outline" onClick={toggleMuteVideo} className="h-8 w-8 rounded-xl">{isVideoMuted ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}</Button><Button size="icon" variant="outline" onClick={handleSwitchCamera} className="h-8 w-8 rounded-xl"><RotateCcw className="h-3.5 w-3.5" /></Button><Button size="sm" variant="secondary" onClick={() => setShowProductPicker(true)} className="h-8 rounded-xl text-xs"><ShoppingBag className="mr-1 h-3.5 w-3.5" />Épingler</Button></div><div className="flex items-center gap-2"><span className="hidden text-[10px] text-white/60 sm:inline">{recordingUploading ? "Sauvegarde du replay…" : isRecording ? "Replay en cours" : ""}</span><Button size="sm" variant="destructive" onClick={() => void handleEndLive()} disabled={recordingUploading} className="h-8 rounded-xl text-xs">Terminer</Button><Button size="sm" variant="ghost" onClick={() => void handleCancelLive()} disabled={recordingUploading} className="h-8 rounded-xl text-xs">Annuler</Button></div></div>}
        </div>

        <div className="w-full md:w-[320px] bg-zinc-900 border-t md:border-t-0 md:border-l border-white/10 flex flex-col h-[300px] md:h-full">
          <div className="p-3 border-b border-white/10 flex items-center justify-between"><div className="flex items-center gap-1.5 text-xs font-bold"><MessageCircle className="h-4 w-4 text-primary" />Direct Chat</div><span className="text-[11px] text-white/50">{messages.length} message{messages.length > 1 ? "s" : ""}</span></div>
          <ScrollArea className="flex-1 p-3" ref={chatScrollRef as any}>{messages.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-center text-white/40"><Sparkles className="h-6 w-6 mb-2 text-primary/60" /><p className="text-xs">Soyez le premier à commenter le live !</p></div> : <div className="space-y-2.5">{messages.map((m) => <div key={m.id} className="flex flex-col text-xs"><span className="font-semibold text-primary text-[11px]">{m.user_name}</span><span className="text-white/90 bg-white/5 rounded-xl px-2.5 py-1.5 mt-0.5 w-fit break-words max-w-[95%]">{m.content}</span></div>)}</div>}</ScrollArea>
          <div className="p-2 border-t border-white/10 bg-zinc-950/50 flex items-center justify-around">{["❤️", "🔥", "👏", "😍", "✨"].map((emoji) => <button key={emoji} type="button" onClick={() => triggerReaction(emoji)} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-sm hover:scale-125">{emoji}</button>)}</div>
          <div className="p-2.5 border-t border-white/10 bg-zinc-950"><div className="flex items-center gap-1.5"><Input value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} placeholder="Envoyer un message au créateur..." className="h-9 rounded-xl bg-zinc-800 border-white/15 text-xs text-white" /><Button size="icon" onClick={handleSendMessage} disabled={!inputMessage.trim()} className="h-9 w-9 shrink-0 rounded-xl"><Send className="h-3.5 w-3.5" /></Button></div></div>
        </div>
      </DialogContent>

      {showProductPicker && <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}><DialogContent className="max-w-md bg-card border-border"><DialogHeader><DialogTitle>Épingler un produit en direct</DialogTitle><DialogDescription>Sélectionnez une création à mettre en avant.</DialogDescription></DialogHeader><ScrollArea className="h-64 mt-2"><div className="space-y-2 pr-3">{creatorProducts.map((p) => <button key={p.id} type="button" onClick={() => handlePinProduct(p)} className={cn("flex w-full items-center gap-3 p-2.5 rounded-2xl border text-left", pinnedProduct?.id === p.id ? "border-primary bg-primary/5" : "border-border")}><div className="h-12 w-12 rounded-xl bg-muted overflow-hidden shrink-0">{p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" /> : <ShoppingBag className="h-5 w-5 m-auto mt-3" />}</div><div className="min-w-0 flex-1"><p className="font-semibold text-xs truncate">{p.name}</p>{p.price != null && <p className="text-xs text-primary font-bold">{Number(p.price).toFixed(3)} TND</p>}</div>{pinnedProduct?.id === p.id && <Badge>Actuel</Badge>}</button>)}</div></ScrollArea></DialogContent></Dialog>}
    </Dialog>
  );
}
