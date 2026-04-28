import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
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
}

export function PrivateChatDialog({
  open, onOpenChange, startupId, startupName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  startupId: string;
  startupName: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      // Find or create conversation
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("startup_id", startupId)
        .maybeSingle();
      let convId = existing?.id;
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
  }, [open, user, startupId]);

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
    if (!content || !conversationId || !user) return;
    setInput("");
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    });
    if (error) toast.error(error.message);
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
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Écrire un message…"
              />
              <Button onClick={send} className="gradient-warm text-primary-foreground" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}