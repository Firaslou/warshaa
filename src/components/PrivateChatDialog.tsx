import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Send, ImagePlus, X, Loader2, Check, CheckCheck, ZoomIn, Download, ExternalLink,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeMediaUrl } from "@/lib/url-security";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { IMAGE_ACCEPT, imageExtensionFor, safeImageForUpload, validateImageFile } from "@/lib/file-security";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
  attachments?: string[] | null;
}

export function PrivateChatDialog({
  open, onOpenChange, startupId, startupName, initialConversationId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  startupId: string;
  startupName: string;
  initialConversationId?: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const markReceivedMessagesRead = useCallback(async (convId: string) => {
    if (!user || document.visibilityState !== "visible") return;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("chat_messages")
      .update({ read_at: readAt })
      .eq("conversation_id", convId)
      .neq("sender_id", user.id)
      .is("read_at", null);
    if (!error) {
      setMessages((current) =>
        current.map((message) =>
          message.sender_id === user.id || message.read_at ? message : { ...message, read_at: readAt }
        )
      );
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("type", "message")
        .eq("link", `/messages?conversation=${convId}`)
        .eq("read", false);
    }
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      let convId = initialConversationId;
      if (!convId) {
        const { data: existing } = await supabase
          .from("chat_conversations")
          .select("id")
          .eq("buyer_id", user.id)
          .eq("startup_id", startupId)
          .maybeSingle();
        convId = existing?.id;
      }
      if (!convId) {
        const { data: created, error } = await supabase
          .from("chat_conversations")
          .insert({ buyer_id: user.id, startup_id: startupId })
          .select("id")
          .single();
        if (error) {
          toast.error(error.message);
          setLoadError(error.message);
          setLoading(false);
          return;
        }
        convId = created.id;
      }
      setConversationId(convId);
      const { data: msgs, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (messagesError) {
        setLoadError(messagesError.message);
        toast.error("Impossible de charger la conversation.");
      } else {
        setMessages((msgs as Message[]) ?? []);
        await markReceivedMessagesRead(convId);
      }
      setLoading(false);
    })();
  }, [open, user, startupId, initialConversationId, markReceivedMessagesRead]);

  // Realtime messages and typing broadcast
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase.channel(`chat:${conversationId}`, {
      config: { private: true },
    });
    typingChannelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const message = payload.new as Message;
          setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
          if (message.sender_id !== user?.id) {
            setIsOtherTyping(false);
            void markReceivedMessagesRead(conversationId);
          }
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.senderId && payload.payload.senderId !== user?.id) {
          setIsOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingChannelRef.current === channel) typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, markReceivedMessagesRead]);

  useEffect(() => {
    if (!open || !conversationId) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void markReceivedMessagesRead(conversationId);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [open, conversationId, markReceivedMessagesRead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOtherTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // Broadcast typing event with debounce/rate-limit
    const now = Date.now();
    if (conversationId && user && now - lastBroadcastRef.current > 1500) {
      lastBroadcastRef.current = now;
      void typingChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { senderId: user.id },
      });
    }
  };

  const send = async () => {
    const content = input.trim();
    if ((!content && pendingFiles.length === 0) || !conversationId || !user) return;

    setUploading(true);
    const attachmentUrls: string[] = [];
    try {
      for (const file of pendingFiles) {
        const compressedFile = await safeImageForUpload(file, 5 * 1024 * 1024, 1080);
        const path = `${conversationId}/${user.id}/${crypto.randomUUID()}.${imageExtensionFor(compressedFile)}`;
        const { error: upErr } = await supabase.storage
          .from("chat-attachments")
          .upload(path, compressedFile, { contentType: compressedFile.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("chat-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) attachmentUrls.push(signed.signedUrl);
      }
    } catch (e: any) {
      toast.error(e.message || "Échec de l'envoi de la photo");
      setUploading(false);
      return;
    }

    setInput("");
    setPendingFiles([]);
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content || "",
      attachments: attachmentUrls,
    });
    setUploading(false);
    if (error) toast.error(error.message);
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const remaining = 3 - pendingFiles.length;
    const accepted: File[] = [];
    for (const f of files.slice(0, remaining)) {
      try {
        await validateImageFile(f, 5 * 1024 * 1024);
        accepted.push(f);
      } catch (error: any) {
        toast.error(`${f.name}: ${error.message}`);
      }
    }
    setPendingFiles((p) => [...p, ...accepted].slice(0, 3));
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-lg overflow-hidden p-0 gap-0 rounded-3xl border-border/80 bg-background shadow-2xl"
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
          onDrop={(event) => { event.preventDefault(); if (!uploading) void addFiles(Array.from(event.dataTransfer.files)); }}
        >
          <DialogHeader className="border-b border-border/60 bg-muted/40 p-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="font-serif text-lg font-bold flex items-center gap-2">
                  <span>{startupName}</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="En ligne" />
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Messagerie privée en direct · Réponses rapides
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!user ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">{t("apply.needAccount")}</p>
            </div>
          ) : (
            <div className="flex flex-col h-[480px]">
              <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                {loading ? (
                  <div className="flex h-full items-center justify-center py-20 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                    {t("common.loading")}
                  </div>
                ) : loadError ? (
                  <div className="py-12 text-center text-xs text-destructive">
                    <p>{loadError}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => onOpenChange(false)}>
                      Fermer et réessayer
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <div className="mb-2 rounded-full bg-primary/10 p-3 text-primary">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                    <p className="font-medium text-foreground text-sm">Démarrez la conversation 👋</p>
                    <p className="text-xs text-muted-foreground max-w-xs mt-1">
                      Posez vos questions sur les créations, les délais de livraison ou les personnalisations.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-2">
                    {messages.map((m) => {
                      const mine = m.sender_id === user.id;
                      const timeStr = m.created_at
                        ? format(new Date(m.created_at), "HH:mm", { locale: fr })
                        : "";
                      return (
                        <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                          <div
                            className={cn(
                              "group relative max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-xs transition",
                              mine
                                ? "bg-primary text-primary-foreground rounded-br-xs"
                                : "bg-card border border-border/80 text-foreground rounded-bl-xs"
                            )}
                          >
                            {m.attachments && m.attachments.length > 0 && (
                              <div
                                className={cn(
                                  "mb-1.5 grid gap-1.5 overflow-hidden rounded-xl",
                                  m.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"
                                )}
                              >
                                {m.attachments.map((url, i) => (
                                  <div
                                    key={i}
                                    className="group/img relative cursor-pointer overflow-hidden rounded-lg bg-black/10 aspect-square"
                                    onClick={() => setLightboxImage(url)}
                                  >
                                    <img
                                      src={url}
                                      alt="pièce jointe"
                                      className="h-full w-full object-cover transition duration-300 group-hover/img:scale-105"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover/img:opacity-100">
                                      <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {m.content && <div className="leading-relaxed whitespace-pre-wrap">{m.content}</div>}

                            <div
                              className={cn(
                                "mt-1 flex items-center gap-1 text-[10px]",
                                mine ? "justify-end text-primary-foreground/75" : "justify-start text-muted-foreground"
                              )}
                            >
                              <span>{timeStr}</span>
                              {mine && (
                                <span title={m.read_at ? "Message lu" : "Message envoyé"}>
                                  {m.read_at ? (
                                    <CheckCheck className="h-3.5 w-3.5 text-sky-200" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5 text-primary-foreground/70" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isOtherTyping && (
                      <div className="flex items-center gap-2 rounded-2xl border bg-card px-3.5 py-2 text-xs text-muted-foreground w-fit animate-in fade-in">
                        <span className="font-medium">{startupName} écrit</span>
                        <div className="flex gap-1 items-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t bg-muted/40 p-2.5 px-4">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="relative h-16 w-16 overflow-hidden rounded-xl border bg-card shadow-xs">
                      <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white backdrop-blur hover:bg-black"
                        aria-label="Retirer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <span className="self-center text-xs text-muted-foreground">
                    {pendingFiles.length}/3 photo{pendingFiles.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div className="border-t border-border/70 p-3 bg-card/60">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    multiple
                    onChange={onPickFiles}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={pendingFiles.length >= 3 || uploading}
                    title="Joindre des photos (max 3, 5 Mo)"
                    className="rounded-xl h-10 w-10 shrink-0"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <Input
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === "Enter" && !uploading && send()}
                    placeholder="Écrire un message…"
                    disabled={uploading}
                    className="rounded-xl h-10 text-sm focus-visible:ring-1 focus-visible:ring-primary"
                  />
                  <Button
                    onClick={send}
                    className="gradient-warm text-primary-foreground rounded-xl h-10 w-10 shrink-0 shadow-xs"
                    size="icon"
                    disabled={uploading || (!input.trim() && pendingFiles.length === 0)}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
          <DialogContent className="max-w-4xl border-0 bg-black/90 p-2 shadow-2xl backdrop-blur-md">
            <div className="relative flex flex-col items-center justify-center">
              <img
                src={lightboxImage}
                alt="Aperçu agrandi"
                className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl"
              />
              <div className="mt-3 flex items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 rounded-full"
                  onClick={() => {
                    const safeUrl = safeMediaUrl(lightboxImage);
                    if (safeUrl) window.open(safeUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ouvrir l'original
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full bg-white/10 text-white hover:bg-white/20 border-white/20"
                  onClick={() => setLightboxImage(null)}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
