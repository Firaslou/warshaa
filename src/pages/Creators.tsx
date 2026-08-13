import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, MessageCircle, X, SearchCheck, Loader2, UsersRound, Hammer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCard, StartupCardData } from "@/components/StartupCard";
import { TUNISIA_GOVERNORATES, TUNISIA_DELEGATIONS, CATEGORIES_KEYS, type Governorate } from "@/lib/tunisia";
import { supabase } from "@/integrations/supabase/client";

export default function Creators() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [startups, setStartups] = useState<StartupCardData[]>([]);
  const [search, setSearch] = useState("");
  const [aiFilters, setAiFilters] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [commentSearch, setCommentSearch] = useState("");
  const [matchedByComment, setMatchedByComment] = useState<Set<string> | null>(null);
  const [searchingComments, setSearchingComments] = useState(false);

  const governorate = params.get("gov") ?? "all";
  const delegation = params.get("del") ?? "all";
  const category = params.get("category") ?? "all";

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("startups")
        .select("id, slug, name, tagline, city, category, cover_url, badge, likes_count, supporters_count, delegation")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (data && data.length > 0) setStartups(data as unknown as StartupCardData[]);
    })();
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
      // 1) Récupère les commentaires qui matchent
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
      // 2) Remonte vers les startups
      const { data: prods } = await supabase
        .from("products")
        .select("startup_id")
        .in("id", productIds);
      setMatchedByComment(new Set((prods ?? []).map((p: any) => p.startup_id)));
      setSearchingComments(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [commentSearch]);

  const delegationsForGov = useMemo(() => {
    if (governorate === "all") return [];
    return TUNISIA_DELEGATIONS[governorate as Governorate] ?? [];
  }, [governorate]);

  const filtered = useMemo(() => {
    return startups.filter((s: any) => {
      if (governorate !== "all" && s.city !== governorate) return false;
      if (delegation !== "all" && s.delegation !== delegation) return false;
      if (category !== "all" && t(`categoriesExt.${category}`) !== s.category && category !== s.category) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
          !s.tagline?.toLowerCase().includes(search.toLowerCase())) return false;
      if (matchedByComment && !matchedByComment.has(s.id)) return false;
      if (aiFilters) {
        const hay = `${s.name} ${s.tagline ?? ""} ${s.category ?? ""}`.toLowerCase();
        const terms: string[] = [
          ...(Array.isArray(aiFilters.keywords) ? aiFilters.keywords : []),
          aiFilters.color,
          aiFilters.category,
        ].filter((x: any) => typeof x === "string" && x.trim().length > 1).map((x: string) => x.toLowerCase());
        if (terms.length && !terms.some((t) => hay.includes(t))) return false;
        if (aiFilters.city) {
          const c = String(aiFilters.city).toLowerCase();
          if (!`${s.city ?? ""} ${s.delegation ?? ""}`.toLowerCase().includes(c)) return false;
        }
      }
      return true;
    });
  }, [startups, governorate, delegation, category, search, matchedByComment, aiFilters, t]);

  const updateParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === "all") next.delete(k); else next.set(k, v);
    });
    setParams(next);
  };

  const resetFilters = () => {
    setParams(new URLSearchParams());
    setSearch("");
    setCommentSearch("");
    setAiFilters(null);
  };

  const hasActiveFilters = governorate !== "all" || delegation !== "all" || category !== "all" || search || commentSearch || aiFilters;

  const runAiSearch = async () => {
    if (!search.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-search", { body: { query: search } });
      if (!error) setAiFilters(data?.filters ?? null);
    } finally { setAiLoading(false); }
  };

  return (
    <PageLayout>
      <div className="container py-12">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-bold md:text-5xl">{t("nav.creators")}</h1>
          <p className="mt-3 text-muted-foreground">{t("home.featuredSubtitle")}</p>
        </div>

        {/* Filtres */}
        <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder='Ex : "céramiste à Nabeul"'
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (aiFilters) setAiFilters(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runAiSearch(); } }}
              className="pl-9 pr-10"
            />
            <button
              type="button"
              onClick={runAiSearch}
              disabled={aiLoading || !search.trim()}
              title="Recherche intelligente (IA)"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40"
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
            </button>
          </div>

          <Select value={governorate} onValueChange={(v) => updateParam({ gov: v, del: "all" })}>
            <SelectTrigger><SelectValue placeholder="Gouvernorat" /></SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">{t("common.all")} — Gouvernorat</SelectItem>
              {TUNISIA_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={delegation}
            onValueChange={(v) => updateParam({ del: v })}
            disabled={governorate === "all"}
          >
            <SelectTrigger>
              <SelectValue placeholder={governorate === "all" ? "Choisir un gouvernorat" : "Délégation"} />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">{t("common.all")} — Délégation</SelectItem>
              {delegationsForGov.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={(v) => updateParam({ category: v })}>
            <SelectTrigger><SelectValue placeholder={t("common.category")} /></SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">{t("common.all")} — {t("common.category")}</SelectItem>
              {CATEGORIES_KEYS.map((k) => (
                <SelectItem key={k} value={k}>{t(`categoriesExt.${k}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <MessageCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans les avis…"
              value={commentSearch}
              onChange={(e) => setCommentSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {aiFilters && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <SearchCheck className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Filtres IA :</span>
            {Array.isArray(aiFilters.keywords) && aiFilters.keywords.map((k: string) => (
              <Badge key={k} variant="secondary">{k}</Badge>
            ))}
            {aiFilters.color && <Badge variant="outline">{aiFilters.color}</Badge>}
            {aiFilters.city && <Badge variant="outline">{aiFilters.city}</Badge>}
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setAiFilters(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {hasActiveFilters && (
          <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
              {searchingComments && " · recherche en cours…"}
            </span>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-3 w-3" /> Réinitialiser
            </Button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <UsersRound className="mx-auto mb-3 h-10 w-10 text-primary/40" />
            <p className="mb-1 font-serif text-xl font-semibold">
              Aucun créateur disponible pour le moment.
            </p>
            <p className="mb-6 text-muted-foreground">Soyez le premier à le faire&nbsp;!</p>
            <Button
              size="lg"
              className="gradient-warm text-primary-foreground"
              onClick={() => navigate("/apply")}
            >
              <Hammer className="mr-2 h-4 w-4" /> Devenir créateur
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((s, i) => <StartupCard key={s.id} startup={s} index={i} />)}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
