import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCard, StartupCardData } from "@/components/StartupCard";
import { DEMO_STARTUPS, TUNISIAN_CITIES, CATEGORIES } from "@/lib/demo";
import { supabase } from "@/integrations/supabase/client";

export default function Creators() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [startups, setStartups] = useState<StartupCardData[]>(DEMO_STARTUPS);
  const [search, setSearch] = useState("");
  const city = params.get("city") ?? "all";
  const category = params.get("category") ?? "all";

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("startups")
        .select("id, slug, name, tagline, city, category, cover_url, badge, likes_count, supporters_count")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (data && data.length > 0) setStartups(data as StartupCardData[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    return startups.filter((s) => {
      if (city !== "all" && s.city !== city) return false;
      if (category !== "all" && s.category !== category) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
          !s.tagline?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [startups, city, category, search]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete(key); else next.set(key, value);
    setParams(next);
  };

  return (
    <PageLayout>
      <div className="container py-12">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-bold md:text-5xl">{t("nav.creators")}</h1>
          <p className="mt-3 text-muted-foreground">{t("home.featuredSubtitle")}</p>
        </div>

        <div className="mb-8 grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={city} onValueChange={(v) => updateParam("city", v)}>
            <SelectTrigger><SelectValue placeholder={t("common.city")} /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">{t("common.all")} — {t("common.city")}</SelectItem>
              {TUNISIAN_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => updateParam("category", v)}>
            <SelectTrigger><SelectValue placeholder={t("common.category")} /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">{t("common.all")} — {t("common.category")}</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

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