import { useCallback, useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MessageCircle, Lock, RefreshCw, Search, CheckCheck, Check, Sparkles, Filter,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { normalizeSearchText } from "@/lib/search-utils";

interface ConvRow {
  id: string;
  buyer_id: string;
  startup_id: string;
  last_message_at: string;
  startup: { id: string; name: string; slug: string; logo_url: string | null } | null;
  buyer: { full_name: string | null; avatar_url: string | null } | null;
  lastMessage?: string;
  unreadCount: number;
}

interface ActiveChat {
  conversationId: string;
  startupId: string;
  name: string;
}

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"buyer" | "seller">("buyer");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveChat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    let query = supabase
      .from("chat_conversations")
      .select("id, buyer_id, startup_id, last_message_at")
      .order("last_message_at", { ascending: false });

    if (tab === "buyer") {
      query = query.eq("buyer_id", user.id);
    } else {
      const { data: myStartups, error: startupsError } = await supabase
        .from("startups")
        .select("id")
        .eq("owner_id", user.id);
      if (startupsError) {
        setError(startupsError.message);
        setLoading(false);
        return;
      }
      const ids = (myStartups ?? []).map((s) => s.id);
      if (ids.length === 0) {
        setConvs([]);
        setLoading(false);
        return;
      }
      query = query.in("startup_id", ids);
    }

    const { data, error: conversationsError } = await query;
    if (conversationsError) {
      setError(conversationsError.message);
      setLoading(false);
      return;
    }
    const rows = (data as any[]) ?? [];

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

    const enriched = await Promise.all(
      rows.map(async (c) => {
        const [{ data: msg }, { count: unreadCount }] = await Promise.all([
          supabase
            .from("chat_messages")
            .select("content,sender_id,read_at")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", c.id)
            .neq("sender_id", user.id)
            .is("read_at", null),
        ]);
        const p = profMap.get(c.buyer_id);
        return {
          ...c,
          startup: startupMap.get(c.startup_id) ?? null,
          buyer: p ? { full_name: p.full_name, avatar_url: p.avatar_url } : null,
          lastMessage: msg?.content ?? "",
          unreadCount: unreadCount ?? 0,
        };
      })
    );
    setConvs(enriched);
    setLoading(false);
  }, [tab, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const requestedId = searchParams.get("conversation");
    if (!requestedId || loading) return;
    const conversation = convs.find((item) => item.id === requestedId);
    if (conversation?.startup) {
      setActive({
        conversationId: conversation.id,
        startupId: conversation.startup.id,
        name: conversation.startup.name,
      });
    }
  }, [convs, loading, searchParams]);

  // Realtime refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("inbox-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  // Filtered conversations
  const filteredConvs = useMemo(() => {
    return convs.filter((c) => {
      if (unreadOnly && c.unreadCount === 0) return false;
      if (searchQuery.trim()) {
        const normQuery = normalizeSearchText(searchQuery);
        const name = tab === "buyer" ? c.startup?.name : c.buyer?.full_name;
        const normName = normalizeSearchText(name);
        const normMsg = normalizeSearchText(c.lastMessage);
        if (!normName.includes(normQuery) && !normMsg.includes(normQuery)) {
          return false;
        }
      }
      return true;
    });
  }, [convs, unreadOnly, searchQuery, tab]);

  const totalUnread = useMemo(() => {
    return convs.reduce((acc, c) => acc + (c.unreadCount > 0 ? 1 : 0), 0);
  }, [convs]);

  if (!user) {
    return (
      <PageLayout>
        <div className="container py-20">
          <EmptyState
            icon={Lock}
            title="Connexion requise"
            description="Connectez-vous pour accéder à vos messages privés et échanger avec les créateurs."
            action={{ label: "Se connecter", to: "/login" }}
            secondaryAction={{ label: "Découvrir les créateurs", to: "/creators" }}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container max-w-4xl py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight">Messagerie</h1>
              <p className="text-xs text-muted-foreground">
                Échangez directement avec les créateurs et vos clients
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-2xl border border-border/80 bg-card p-1 shadow-xs">
            {(["buyer", "seller"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "rounded-xl px-4 py-1.5 text-xs font-semibold transition",
                  tab === k
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "buyer" ? "Mes conversations" : "En tant que créateur"}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une conversation ou un message..."
              className="h-10 rounded-2xl pl-10 text-xs shadow-xs"
            />
          </div>

          <Button
            variant={unreadOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className="rounded-2xl text-xs gap-1.5 shrink-0"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Non lus ({totalUnread})</span>
          </Button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
            {t("common.loading")}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="text-sm text-destructive">Impossible de charger vos conversations.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
            </Button>
          </div>
        ) : convs.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title={tab === "buyer" ? "Aucune conversation" : "Aucun message reçu"}
            description={
              tab === "buyer"
                ? "Vous n'avez pas encore échangé avec de créateur. Parcourez la galerie et posez vos questions !"
                : "Vous n'avez pas encore de message pour vos créations."
            }
            action={
              tab === "buyer"
                ? { label: "Découvrir les créateurs", to: "/creators" }
                : { label: "Voir ma boutique", to: "/creator" }
            }
            secondaryAction={{ label: "Explorer les produits", to: "/products" }}
          />
        ) : filteredConvs.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Aucune conversation correspondante"
            description="Aucune conversation ne correspond à votre recherche ou filtre."
            action={{
              label: "Effacer la recherche",
              onClick: () => {
                setSearchQuery("");
                setUnreadOnly(false);
              },
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs divide-y divide-border/60">
            {filteredConvs.map((c) => {
              const display =
                tab === "buyer"
                  ? { name: c.startup?.name ?? "Boutique", avatar: c.startup?.logo_url }
                  : { name: c.buyer?.full_name ?? "Client", avatar: c.buyer?.avatar_url };

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (!c.startup) return;
                    setActive({
                      conversationId: c.id,
                      startupId: c.startup.id,
                      name: c.startup.name,
                    });
                    setSearchParams({ conversation: c.id });
                  }}
                  className={cn(
                    "flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-muted/40",
                    c.unreadCount > 0 && "bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted shadow-xs">
                    {display.avatar ? (
                      <img src={display.avatar} alt={display.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-bold text-sm text-primary">
                        {display.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {c.unreadCount > 0 && (
                      <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-background bg-primary ring-1 ring-primary" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate font-semibold text-sm", c.unreadCount > 0 && "text-foreground font-bold")}>
                        {display.name}
                      </p>
                      <div className="flex items-center gap-2">
                        {c.unreadCount > 0 && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-xs">
                            {c.unreadCount} nouveau{c.unreadCount > 1 ? "x" : ""}
                          </span>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </div>

                    <p className={cn("mt-1 truncate text-xs text-muted-foreground", c.unreadCount > 0 && "font-medium text-foreground")}>
                      {c.lastMessage || "Conversation démarrée 👋"}
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
          onOpenChange={(v) => {
            if (!v) {
              setActive(null);
              setSearchParams({});
              void load();
            }
          }}
          startupId={active.startupId}
          startupName={active.name}
          initialConversationId={active.conversationId}
        />
      )}
    </PageLayout>
  );
}
