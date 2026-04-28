import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, MessageCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCard, StartupCardData } from "@/components/StartupCard";
import { DEMO_STARTUPS } from "@/lib/demo";
import { TUNISIA_GOVERNORATES, TUNISIA_DELEGATIONS, CATEGORIES_KEYS, type Governorate } from "@/lib/tunisia";
import { supabase } from "@/integrations/supabase/client";

export default function Creators() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [startups, setStartups] = useState<StartupCardData[]>(DEMO_STARTUPS);
  const [search, setSearch] = useState("");
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
      return true;
    });
  }, [startups, governorate, delegation, category, search, matchedByComment, t]);

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
  };

  const hasActiveFilters = governorate !== "all" || delegation !== "all" || category !== "all" || search || commentSearch;

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
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
          <p className="py-20 text-center text-muted-foreground">{t("discover.noResults")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((s, i) => <StartupCard key={s.id} startup={s} index={i} />)}
          </div>
        )}
      </div>
    </PageLayout>
  );
}