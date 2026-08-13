import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Radio, X, Heart, Flame, Sparkles, ThumbsUp, Send, MessageCircle,
  Eye, ShoppingBag, Pause, Play, Mic, MicOff, Camera, Video, VideoOff,
  Share2, Store, ExternalLink, AlertCircle, CheckCircle2, RotateCcw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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

interface LiveMessage {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url?: string | null;
  content: string;
  created_at: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number; // percentage
}

interface PinnedProduct {
  id: string;
  name: string;
  price: number | null;
  discount_percentage?: number | null;
  currency: string;
  images: string[];
  description?: string | null;
  startup_id?: string;
  whatsapp_number?: string | null;
}

interface LiveRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveEventId: string;
  startupId: string;
  startupName: string;
  startupSlug: string;
  startupLogo?: string | null;
  isCreator?: boolean;
  initialStreamUrl?: string | null;
}

export function LiveRoomModal({
  open,
  onOpenChange,
  liveEventId,
  startupId,
  startupName,
  startupSlug,
  startupLogo,
  isCreator = false,
  initialStreamUrl,
}: LiveRoomModalProps) {
  const { t } = useTranslation();
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

  // Creator broadcast hardware controls
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // Load startup products for creator to pin
  useEffect(() => {
    if (!open || !startupId) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, discount_percentage, currency, images, description, startup_id")
        .eq("startup_id", startupId)
        .limit(20);
      if (data) {
        setCreatorProducts(data as any[]);
        if (data.length > 0 && !pinnedProduct) {
          setPinnedProduct(data[0] as any);
        }
      }
    })();
  }, [open, startupId]);

  // Handle Hardware Camera Stream for Creator
  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: true,
      });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera access not available or denied:", err);
    }
  }, [facingMode, mediaStream]);

  useEffect(() => {
    if (open && isCreator) {
      void startCamera();
    }
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [open, isCreator]);

  // Realtime Channel for Live Room (Presence, Chat, Reactions, Status, Pinned Products)
  useEffect(() => {
    if (!open || !liveEventId) return;

    const channelName = `live_room:${liveEventId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: user?.id || `anon-${Math.random().toString(36).slice(2, 7)}` },
      },
    });

    channelRef.current = channel;

    // Presence: track active viewers
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      setViewerCount(Math.max(1, count));
    });

    // Broadcast messages
    channel
      .on("broadcast", { event: "chat_message" }, (payload) => {
        if (payload.payload) {
          setMessages((prev) => [...prev, payload.payload]);
        }
      })
      .on("broadcast", { event: "reaction" }, (payload) => {
        if (payload.payload?.emoji) {
          triggerReaction(payload.payload.emoji, false);
        }
      })
      .on("broadcast", { event: "status_change" }, (payload) => {
        if (payload.payload?.status) {
          setLiveStatus(payload.payload.status);
          if (payload.payload.status === "ended") {
            toast.info("Le live est maintenant terminé.");
          } else if (payload.payload.status === "paused") {
            toast.info("Le créateur a mis le direct en pause.");
          }
        }
      })
      .on("broadcast", { event: "pin_product" }, (payload) => {
        if (payload.payload?.product) {
          setPinnedProduct(payload.payload.product);
          toast.success(`Nouveau produit présenté : ${payload.payload.product.name}`);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user?.id,
            userName: user?.email?.split("@")[0] || "Spectateur",
            isCreator,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [open, liveEventId, user, isCreator]);

  // Scroll chat down when new message arrives
  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Reaction Animation helper
  const triggerReaction = (emoji: string, broadcast = true) => {
    const id = `${Date.now()}-${Math.random()}`;
    const left = Math.floor(Math.random() * 60) + 20; // 20% to 80% horizontal offset
    setReactions((prev) => [...prev, { id, emoji, left }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);

    if (broadcast && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "reaction",
        payload: { emoji },
      });
    }
  };

  // Send message
  const handleSendMessage = () => {
    const text = inputMessage.trim();
    if (!text) return;

    const newMsg: LiveMessage = {
      id: `${Date.now()}-${Math.random()}`,
      user_id: user?.id || "anon",
      user_name: user?.email?.split("@")[0] || "Visiteur",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "chat_message",
        payload: newMsg,
      });
    }
  };

  // Creator Controls: Pause / Resume
  const togglePauseLive = async () => {
    const newStatus = liveStatus === "live" ? "paused" : "live";
    setLiveStatus(newStatus);

    if (mediaStream) {
      mediaStream.getVideoTracks().forEach((track) => (track.enabled = newStatus === "live"));
      mediaStream.getAudioTracks().forEach((track) => (track.enabled = newStatus === "live"));
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "status_change",
        payload: { status: newStatus },
      });
    }

    toast.info(newStatus === "paused" ? "Live mis en pause" : "Live repris en direct !");
  };

  // Creator Controls: Mute Audio
  const toggleMuteAudio = () => {
    if (!mediaStream) return;
    const nextMuted = !isAudioMuted;
    mediaStream.getAudioTracks().forEach((track) => (track.enabled = !nextMuted));
    setIsAudioMuted(nextMuted);
    toast.info(nextMuted ? "Micro coupé" : "Micro activé");
  };

  // Creator Controls: Mute Video
  const toggleMuteVideo = () => {
    if (!mediaStream) return;
    const nextMuted = !isVideoMuted;
    mediaStream.getVideoTracks().forEach((track) => (track.enabled = !nextMuted));
    setIsVideoMuted(nextMuted);
    toast.info(nextMuted ? "Caméra désactivée" : "Caméra activée");
  };

  // Creator Controls: Switch Camera
  const handleSwitchCamera = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    void startCamera(nextMode);
  };

  // Creator Controls: Pin product
  const handlePinProduct = (product: PinnedProduct) => {
    setPinnedProduct(product);
    setShowProductPicker(false);

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "pin_product",
        payload: { product },
      });
    }
    toast.success(`Produit épinglé : ${product.name}`);
  };

  // Creator Controls: End Live
  const handleEndLive = async () => {
    if (!confirm("Voulez-vous vraiment terminer ce live pour tous les spectateurs ?")) return;

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }

    setLiveStatus("ended");

    // Update database status
    await Promise.all([
      supabase
        .from("live_events")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("id", liveEventId),
      supabase
        .from("startups")
        .update({ is_live: false, live_started_at: null })
        .eq("id", startupId),
    ]);

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "status_change",
        payload: { status: "ended" },
      });
    }

    toast.success("Live terminé avec succès !");
    onOpenChange(false);
  };

  // Creator Controls: Cancel Live
  const handleCancelLive = async () => {
    if (!confirm("Annuler et supprimer ce live ?")) return;

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }

    await Promise.all([
      supabase
        .from("live_events")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", liveEventId),
      supabase
        .from("startups")
        .update({ is_live: false, live_started_at: null })
        .eq("id", startupId),
    ]);

    toast.info("Live annulé.");
    onOpenChange(false);
  };

  const isFav = isStartupFavorite(startupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] max-h-[720px] p-0 overflow-hidden rounded-3xl border-border/70 bg-black text-white shadow-2xl flex flex-col md:flex-row">
        {/* LEFT COLUMN: LIVE VIDEO STREAM / CANVAS */}
        <div className="relative flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
          {/* Header overlay */}
          <div className="relative z-20 flex items-center justify-between p-3.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-2.5">
              <Link
                to={`/startup/${startupSlug}`}
                className="flex items-center gap-2 rounded-full bg-black/50 pr-3 p-1 backdrop-blur border border-white/15 hover:bg-black/70 transition"
              >
                {startupLogo ? (
                  <img src={startupLogo} alt={startupName} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold">
                    {startupName.charAt(0)}
                  </div>
                )}
                <span className="text-xs font-semibold truncate max-w-[120px]">{startupName}</span>
              </Link>

              {/* Live status badge */}
              {liveStatus === "live" ? (
                <div className="flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white uppercase shadow-md animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  <span>En direct</span>
                </div>
              ) : liveStatus === "paused" ? (
                <div className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-[10px] font-bold text-black uppercase shadow-md">
                  <Pause className="h-3 w-3" />
                  <span>En pause</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 rounded-full bg-zinc-600 px-2.5 py-1 text-[10px] font-bold text-white uppercase">
                  <span>Terminé</span>
                </div>
              )}

              <div className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium backdrop-blur border border-white/10">
                <Eye className="h-3.5 w-3.5 text-rose-400" />
                <span>{viewerCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void toggleStartupFavorite(startupId)}
                className={cn("h-8 rounded-full px-2.5 text-xs", isFav ? "text-rose-500" : "text-white/80")}
                title={isFav ? "Abonné" : "S'abonner"}
              >
                <Heart className={cn("h-4 w-4 mr-1", isFav && "fill-rose-500")} />
                {isFav ? "Abonné" : "Suivre"}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-full text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Video Stream Area */}
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-zinc-950">
            {isCreator ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "h-full w-full object-cover",
                  facingMode === "user" && "scale-x-[-1]",
                  isVideoMuted && "hidden"
                )}
              />
            ) : initialStreamUrl ? (
              <iframe
                src={initialStreamUrl}
                title="Live stream"
                className="h-full w-full border-0"
                allow="autoplay; camera; microphone; fullscreen"
              />
            ) : (
              // Simulated Interactive Live Canvas for viewers
              <div className="relative h-full w-full flex flex-col items-center justify-center overflow-hidden gradient-soft">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-zinc-900/60 to-black" />
                <div className="relative z-10 flex flex-col items-center text-center p-6">
                  <div className="relative mb-4">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-primary to-amber-500 p-1 animate-spin duration-3000">
                      <div className="h-full w-full rounded-full bg-zinc-900 flex items-center justify-center">
                        <Store className="h-10 w-10 text-primary" />
                      </div>
                    </div>
                    <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 border-2 border-zinc-900" />
                  </div>
                  <h3 className="font-serif text-xl font-bold">{startupName}</h3>
                  <p className="text-xs text-white/70 mt-1 max-w-xs">
                    Présentation en direct des créations artisanales et réponses aux questions.
                  </p>
                </div>
              </div>
            )}

            {/* Paused Overlay */}
            {liveStatus === "paused" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs p-6 text-center">
                <div className="mb-3 rounded-full bg-amber-500/20 p-4 text-amber-400">
                  <Pause className="h-8 w-8" />
                </div>
                <h4 className="font-serif text-lg font-bold">Le direct est en pause</h4>
                <p className="text-xs text-white/70 mt-1">Le créateur reprendra la diffusion dans un instant.</p>
              </div>
            )}

            {/* Ended Overlay */}
            {liveStatus === "ended" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs p-6 text-center">
                <div className="mb-3 rounded-full bg-primary/20 p-4 text-primary">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h4 className="font-serif text-xl font-bold">Ce live est terminé</h4>
                <p className="text-xs text-white/70 mt-1 max-w-sm">
                  Merci d'avoir participé ! Retrouvez toutes les créations de {startupName} sur sa boutique.
                </p>
                <Button asChild className="mt-4 gradient-warm text-primary-foreground rounded-2xl">
                  <Link to={`/startup/${startupSlug}`}>Voir la boutique</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Floating Reactions Container */}
          <div className="pointer-events-none absolute inset-x-0 bottom-24 top-16 z-10 overflow-hidden">
            {reactions.map((r) => (
              <div
                key={r.id}
                style={{ left: `${r.left}%` }}
                className="absolute bottom-2 text-3xl animate-floating-heart drop-shadow-md select-none"
              >
                {r.emoji}
              </div>
            ))}
          </div>

          {/* Pinned Product Card (Bottom Left Overlay) */}
          {pinnedProduct && liveStatus !== "ended" && (
            <div className="relative z-20 m-3 max-w-[280px] rounded-2xl border border-white/20 bg-black/70 p-2.5 backdrop-blur-md shadow-xl animate-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center gap-2.5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-800 border border-white/10">
                  {pinnedProduct.images?.[0] ? (
                    <img src={pinnedProduct.images[0]} alt={pinnedProduct.name} className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-6 w-6 text-white/40 m-auto mt-3" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="h-4 px-1 text-[9px] border-primary text-primary">
                      En direct
                    </Badge>
                  </div>
                  <p className="truncate text-xs font-semibold text-white mt-0.5">{pinnedProduct.name}</p>
                  {pinnedProduct.price != null && (
                    <p className="text-xs font-bold text-primary">
                      {Number(pinnedProduct.price).toFixed(3)} {pinnedProduct.currency || "TND"}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-8 rounded-xl gradient-warm text-primary-foreground text-xs px-2.5 shrink-0"
                  onClick={() =>
                    openWhatsApp({
                      phone: pinnedProduct.whatsapp_number || "+21620000000",
                      productName: pinnedProduct.name,
                      startupId,
                      productId: pinnedProduct.id,
                      message: `Bonjour, j'ai vu votre produit "${pinnedProduct.name}" pendant votre LIVE sur Warsha !`,
                    })
                  }
                >
                  Acheter
                </Button>
              </div>
            </div>
          )}

          {/* Creator Live Controls Toolbar (Bottom Overlay) */}
          {isCreator && (
            <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={liveStatus === "paused" ? "default" : "outline"}
                  onClick={togglePauseLive}
                  className="h-8 rounded-xl text-xs gap-1"
                >
                  {liveStatus === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  <span>{liveStatus === "paused" ? "Reprendre" : "Pause"}</span>
                </Button>

                <Button
                  size="icon"
                  variant="outline"
                  onClick={toggleMuteAudio}
                  className="h-8 w-8 rounded-xl"
                  title={isAudioMuted ? "Activer micro" : "Couper micro"}
                >
                  {isAudioMuted ? <MicOff className="h-3.5 w-3.5 text-rose-400" /> : <Mic className="h-3.5 w-3.5" />}
                </Button>

                <Button
                  size="icon"
                  variant="outline"
                  onClick={toggleMuteVideo}
                  className="h-8 w-8 rounded-xl"
                  title={isVideoMuted ? "Activer caméra" : "Couper caméra"}
                >
                  {isVideoMuted ? <VideoOff className="h-3.5 w-3.5 text-rose-400" /> : <Video className="h-3.5 w-3.5" />}
                </Button>

                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleSwitchCamera}
                  className="h-8 w-8 rounded-xl"
                  title="Tourner la caméra"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowProductPicker(true)}
                  className="h-8 rounded-xl text-xs gap-1"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                  <span>Épingler</span>
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleEndLive}
                  className="h-8 rounded-xl text-xs font-bold"
                >
                  Terminer le live
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelLive}
                  className="h-8 rounded-xl text-xs text-white/60 hover:text-white"
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: LIVE CHAT & AUDIENCE INTERACTIONS */}
        <div className="w-full md:w-[320px] bg-zinc-900 border-t md:border-t-0 md:border-l border-white/10 flex flex-col h-[300px] md:h-full">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span>Direct Chat</span>
            </div>
            <span className="text-[11px] text-white/50">{messages.length} message{messages.length > 1 ? "s" : ""}</span>
          </div>

          {/* Chat Messages Stream */}
          <ScrollArea className="flex-1 p-3" ref={chatScrollRef as any}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-white/40">
                <Sparkles className="h-6 w-6 mb-2 text-primary/60" />
                <p className="text-xs">Soyez le premier à commenter le live !</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {messages.map((m) => (
                  <div key={m.id} className="flex flex-col text-xs leading-relaxed animate-in fade-in slide-in-from-bottom-1">
                    <span className="font-semibold text-primary text-[11px]">{m.user_name}</span>
                    <span className="text-white/90 bg-white/5 rounded-xl px-2.5 py-1.5 mt-0.5 w-fit break-words max-w-[95%]">
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Floating Reaction Bar */}
          <div className="p-2 border-t border-white/10 bg-zinc-950/50 flex items-center justify-around">
            {["❤️", "🔥", "👏", "😍", "✨"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => triggerReaction(emoji, true)}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-sm transition hover:scale-125 active:scale-95"
                title={`Envoyer ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Message Input Box */}
          <div className="p-2.5 border-t border-white/10 bg-zinc-950">
            <div className="flex items-center gap-1.5">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Envoyer un message au créateur..."
                className="h-9 rounded-xl bg-zinc-800 border-white/15 text-xs text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-primary"
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="h-9 w-9 shrink-0 rounded-xl gradient-warm text-primary-foreground"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Creator Product Picker Dialog */}
      {showProductPicker && (
        <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg">Épingler un produit en direct</DialogTitle>
              <DialogDescription className="text-xs">
                Sélectionnez une création à mettre en avant pour vos spectateurs.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="h-64 mt-2">
              <div className="space-y-2 pr-3">
                {creatorProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePinProduct(p)}
                    className={cn(
                      "flex w-full items-center gap-3 p-2.5 rounded-2xl border text-left transition hover:bg-muted",
                      pinnedProduct?.id === p.id ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden shrink-0">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 m-auto mt-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs truncate">{p.name}</p>
                      {p.price != null && (
                        <p className="text-xs text-primary font-bold">{Number(p.price).toFixed(3)} TND</p>
                      )}
                    </div>
                    {pinnedProduct?.id === p.id && (
                      <Badge variant="default" className="text-[10px]">Actuel</Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
