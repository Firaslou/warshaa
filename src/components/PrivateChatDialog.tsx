import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, ImagePlus, X, Loader2 } from "lucide-react";
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

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      // Open an existing inbox conversation, or find/create one from a boutique page.
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
        if (error) { toast.error(error.message); setLoading(false); return; }
        convId = created.id;
      }
      setConversationId(convId);
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      setMessages((msgs as Message[]) ?? []);
      setLoading(false);
    })();
  }, [open, user, startupId, initialConversationId]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((m) => [...m, payload.new as Message]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if ((!content && pendingFiles.length === 0) || !conversationId || !user) return;

    setUploading(true);
    const attachmentUrls: string[] = [];
    try {
      for (const file of pendingFiles) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${conversationId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
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

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = 3 - pendingFiles.length;
    const accepted: File[] = [];
    for (const f of files.slice(0, remaining)) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} dépasse 5 Mo`);
        continue;
      }
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} n'est pas une image`);
        continue;
      }
      accepted.push(f);
    }
    setPendingFiles((p) => [...p, ...accepted].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat avec {startupName}</DialogTitle>
          <DialogDescription>Messagerie privée — réponses sous 24h.</DialogDescription>
        </DialogHeader>
        {!user ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("apply.needAccount")}</p>
        ) : (
          <>
            <ScrollArea className="h-80 rounded-md border bg-muted/30 p-3" ref={scrollRef as any}>
              {loading ? (
                <p className="text-center text-xs text-muted-foreground">{t("common.loading")}</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">Démarrez la conversation 👋</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => {
                    const mine = m.sender_id === user.id;
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                          mine ? "bg-primary text-primary-foreground" : "bg-card border",
                        )}>
                          {m.attachments && m.attachments.length > 0 && (
                            <div className={cn("mb-1 grid gap-1", m.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                              {m.attachments.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt="pièce jointe" className="max-h-48 w-full rounded-lg object-cover" />
                                </a>
                              ))}
                            </div>
                          )}
                          {m.content && <div>{m.content}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md">
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                      aria-label="Retirer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
                title="Joindre des photos (max 3, 5 Mo chacune)"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !uploading && send()}
                placeholder="Écrire un message…"
                disabled={uploading}
              />
              <Button
                onClick={send}
                className="gradient-warm text-primary-foreground"
                size="icon"
                disabled={uploading || (!input.trim() && pendingFiles.length === 0)}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}