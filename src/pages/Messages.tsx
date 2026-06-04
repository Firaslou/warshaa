import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle, Lock } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ConvRow {
  id: string;
  buyer_id: string;
  startup_id: string;
  last_message_at: string;
  startup: { id: string; name: string; slug: string; logo_url: string | null } | null;
  buyer: { full_name: string | null; avatar_url: string | null } | null;
  lastMessage?: string;
  unread?: boolean;
}

interface ActiveChat {
  conversationId: string;
  startupId: string;
  name: string;
}

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<"buyer" | "seller">("buyer");
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveChat | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("chat_conversations")
      .select("id, buyer_id, startup_id, last_message_at")
      .order("last_message_at", { ascending: false });

    if (tab === "buyer") {
      query = query.eq("buyer_id", user.id);
    } else {
      const { data: myStartups } = await supabase
        .from("startups").select("id").eq("owner_id", user.id);
      const ids = (myStartups ?? []).map((s) => s.id);
      if (ids.length === 0) { setConvs([]); setLoading(false); return; }
      query = query.in("startup_id", ids);
    }

    const { data } = await query;
    const rows = (data as any[]) ?? [];

    // Fetch linked boutique, buyer profile, and last message without relying on embedded joins.
    const buyerIds = Array.from(new Set(rows.map((r) => r.buyer_id)));
    const startupIds = Array.from(new Set(rows.map((r) => r.startup_id)));
    const [{ data: profs }, { data: startups }] = await Promise.all([
      buyerIds.length
        ? supabase.from("profiles").select("id,full_name,avatar_url").in("id", buyerIds)
        : Promise.resolve({ data: [] as any[] }),
      startupIds.length
        ? supabase.from("startups").select("id,name,slug,logo_url").in("id", startupIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const startupMap = new Map((startups ?? []).map((s: any) => [s.id, s]));

    const enriched = await Promise.all(rows.map(async (c) => {
      const { data: msg } = await supabase
        .from("chat_messages").select("content,sender_id")
        .eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const p = profMap.get(c.buyer_id);
      return {
        ...c,
        startup: startupMap.get(c.startup_id) ?? null,
        buyer: p ? { full_name: p.full_name, avatar_url: p.avatar_url } : null,
        lastMessage: msg?.content ?? "",
      };
    }));
    setConvs(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, tab]);

  // Realtime refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, tab]);

  if (!user) {
    return (
      <PageLayout>
        <div className="container py-20 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-4">Connectez-vous pour voir vos messages.</p>
          <Link to="/login" className="text-primary underline">Se connecter</Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container max-w-3xl py-10">
        <div className="mb-6 flex items-center gap-3">
          <MessageCircle className="h-7 w-7 text-primary" />
          <h1 className="font-serif text-3xl font-bold">Messages</h1>
        </div>

        <div className="mb-6 inline-flex rounded-lg border bg-card p-1">
          {(["buyer", "seller"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition",
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "buyer" ? "Mes conversations" : "En tant que créateur"}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : convs.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {tab === "buyer"
                ? "Aucune conversation. Visitez un créateur pour commencer."
                : "Aucun message reçu pour vos boutiques."}
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {convs.map((c) => {
              const display = tab === "buyer"
                ? { name: c.startup?.name ?? "Boutique", avatar: c.startup?.logo_url }
                : { name: c.buyer?.full_name ?? "Client", avatar: c.buyer?.avatar_url };
              return (
                <button
                  key={c.id}
                  onClick={() => c.startup && setActive({ conversationId: c.id, startupId: c.startup.id, name: c.startup.name })}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/50"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                    {display.avatar ? (
                      <img src={display.avatar} alt={display.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                        {display.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{display.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.lastMessage || "Conversation démarrée"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {active && (
        <PrivateChatDialog
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          startupId={active.startupId}
          startupName={active.name}
          initialConversationId={active.conversationId}
        />
      )}
    </PageLayout>
  );
}
