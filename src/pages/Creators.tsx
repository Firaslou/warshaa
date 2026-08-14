import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle, X, SearchCheck, Loader2, UsersRound, Hammer, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCard, StartupCardData } from "@/components/StartupCard";
import { SmartSearchInput } from "@/components/search/SmartSearchInput";
import { EmptyState } from "@/components/ui/empty-state";
import { TUNISIA_GOVERNORATES, TUNISIA_DELEGATIONS, CATEGORIES_KEYS, type Governorate } from "@/lib/tunisia";
import { supabase } from "@/integrations/supabase/client";
import { fuzzyMatch } from "@/lib/search-utils";

export default function Creators() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [startups, setStartups] = useState<StartupCardData[]>([]);
  const [aiFilters, setAiFilters] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [commentSearch, setCommentSearch] = useState("");
  const [matchedByComment, setMatchedByComment] = useState<Set<string> | null>(null);
  const [searchingComments, setSearchingComments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const search = params.get("q") ?? "";
  const governorate = params.get("gov") ?? "all";
  const delegation = params.get("del") ?? "all";
  const category = params.get("category") ?? "all";

  const loadStartups = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("startups")
      .select("id, slug, name, tagline, city, category, logo_url, badge, likes_count, supporters_count, delegation")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (error) setLoadError(error.message);
    else setStartups((data ?? []) as unknown as StartupCardData[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadStartups();
    const channel = supabase
      .channel("creators-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "startups" }, () => void loadStartups())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Recherche dans les commentaires (debounced)
  useEffect(() => {
    const term = commentSearch.trim();
    if (!term) {
      setMatchedByComment(null);
      return;
    }
    setSearchingComments(true);
    const timer = setTimeout(async () => {
      const { data: comments } = await supabase
        .from("product_comments")
        .select("product_id")
        .ilike("content", `%${term}%`)
        .limit(500);
      const productIds = Array.from(new Set((comments ?? []).map((c: any) => c.product_id)));
      if (productIds.length === 0) {
        setMatchedByComment(new Set());
        setSearchingComments(false);
        return;
      }
      const { data: prods } = await supabase
        .from("products")
        .select("startup_id")
        .eq("is_published", true)
        .in("id", productIds);
      setMatchedByComment(new Set((prods ?? []).map((p: any) => p.startup_id)));
      setSearchingComments(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [commentSearch]);

  const updateParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === "all" || !v) next.delete(k);
      else next.set(k, v);
    });
    setParams(next, { replace: true });
  };

  const setSearch = (val: string) => {
    updateParam({ q: val });
    if (aiFilters) setAiFilters(null);
  };

  const delegationsForGov = useMemo(() => {
    if (governorate === "all") return [];
    return TUNISIA_DELEGATIONS[governorate as Governorate] ?? [];
  }, [governorate]);

  const suggestionsPool = useMemo(() => {
    const list: Array<{ label: string; category?: string }> = [];
    startups.forEach((s) => {
      if (s.name) list.push({ label: s.name, category: s.category || undefined });
      if (s.category) list.push({ label: s.category });
    });
    return list;
  }, [startups]);

  const filtered = useMemo(() => {
    return startups.filter((s: any) => {
      if (governorate !== "all" && s.city !== governorate) return false;
      if (delegation !== "all" && s.delegation !== delegation) return false;
      if (category !== "all" && t(`categoriesExt.${category}`) !== s.category && category !== s.category) return false;

      if (search.trim()) {
        const textTarget = `${s.name} ${s.tagline ?? ""} ${s.category ?? ""} ${s.city ?? ""} ${s.delegation ?? ""}`;
        if (!fuzzyMatch(search, textTarget)) return false;
      }

      if (matchedByComment && !matchedByComment.has(s.id)) return false;

      if (aiFilters) {
        const hay = `${s.name} ${s.tagline ?? ""} ${s.category ?? ""}`.toLowerCase();
        const terms: string[] = [
          ...(Array.isArray(aiFilters.keywords) ? aiFilters.keywords : []),
          aiFilters.color,
          aiFilters.category,
        ]
          .filter((x: any) => typeof x === "string" && x.trim().length > 1)
          .map((x: string) => x.toLowerCase());
        if (terms.length && !terms.some((t) => hay.includes(t))) return false;
        if (aiFilters.city) {
          const c = String(aiFilters.city).toLowerCase();
          if (!`${s.city ?? ""} ${s.delegation ?? ""}`.toLowerCase().includes(c)) return false;
        }
      }
      return true;
    });
  }, [startups, governorate, delegation, category, search, matchedByComment, aiFilters, t]);

  const resetFilters = () => {
    setParams({}, { replace: true });
    setCommentSearch("");
    setAiFilters(null);
  };

  const hasActiveFilters =
    governorate !== "all" || delegation !== "all" || category !== "all" || search || commentSearch || aiFilters;

  const runAiSearch = async () => {
    if (!search.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-search", { body: { query: search } });
      if (!error) setAiFilters(data?.filters ?? null);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <PageLayout>
      <div className="container py-6 sm:py-10">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight md:text-5xl">{t("nav.creators")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("home.featuredSubtitle")}</p>
        </div>

        {/* Filtres & Recherche intelligente */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SmartSearchInput
              value={search}
              onChange={setSearch}
              suggestionsPool={suggestionsPool}
              placeholder="Rechercher un artisan, atelier, ville..."
              aiLoading={aiLoading}
              onRunAiSearch={runAiSearch}
            />
          </div>

          <Select value={governorate} onValueChange={(v) => updateParam({ gov: v, del: "all" })}>
            <SelectTrigger className="h-11 rounded-2xl text-sm shadow-xs">
              <SelectValue placeholder="Gouvernorat" />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">{t("common.all")} — Gouvernorat</SelectItem>
              {TUNISIA_GOVERNORATES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={delegation}
            onValueChange={(v) => updateParam({ del: v })}
            disabled={governorate === "all"}
          >
            <SelectTrigger className="h-11 rounded-2xl text-sm shadow-xs">
              <SelectValue placeholder={governorate === "all" ? "Choisir un gouvernorat" : "Délégation"} />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">{t("common.all")} — Délégation</SelectItem>
              {delegationsForGov.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={(v) => updateParam({ category: v })}>
            <SelectTrigger className="h-11 rounded-2xl text-sm shadow-xs">
              <SelectValue placeholder={t("common.category")} />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">
                {t("common.all")} — {t("common.category")}
              </SelectItem>
              {CATEGORIES_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`categoriesExt.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Secondary comment search */}
        <div className="mb-4 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <MessageCircle className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans les avis et retours clients…"
              value={commentSearch}
              onChange={(e) => setCommentSearch(e.target.value)}
              className="h-9 rounded-2xl pl-10 text-xs shadow-xs"
            />
          </div>
        </div>

        {aiFilters && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <SearchCheck className="h-4 w-4 text-primary" />
            <span className="font-medium text-muted-foreground">Filtres IA :</span>
            {Array.isArray(aiFilters.keywords) &&
              aiFilters.keywords.map((k: string) => (
                <Badge key={k} variant="secondary" className="rounded-full">
                  {k}
                </Badge>
              ))}
            {aiFilters.color && (
              <Badge variant="outline" className="rounded-full">
                Couleur: {aiFilters.color}
              </Badge>
            )}
            {aiFilters.city && (
              <Badge variant="outline" className="rounded-full">
                {aiFilters.city}
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 rounded-full px-2" onClick={() => setAiFilters(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {hasActiveFilters && (
          <div className="mb-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filtered.length} créateur{filtered.length > 1 ? "s" : ""}
              {searchingComments && " · recherche dans les commentaires…"}
            </span>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
              <X className="mr-1 h-3 w-3" /> Réinitialiser
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
            {t("common.loading")}
          </div>
        ) : loadError ? (
          <div className="py-20 text-center">
            <p className="text-sm text-destructive">Impossible de charger les créateurs.</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={loadStartups}>
              <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={UsersRound}
              title="Aucun créateur ne correspond à vos filtres"
              description="Essayez de modifier votre recherche ou de réinitialiser les filtres géographiques et catégories."
              action={{
                label: "Réinitialiser les filtres",
                onClick: resetFilters,
              }}
              secondaryAction={{
                label: "Devenir créateur",
                to: "/apply",
              }}
              suggestions={["Poterie", "Céramique", "Tapis", "Cuir", "Huile d'olive", "Bijoux"]}
              onSelectSuggestion={(s) => setSearch(s)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((s, i) => (
              <StartupCard key={s.id} startup={s} index={i} />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
