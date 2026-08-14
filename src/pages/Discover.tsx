import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Heart, ArrowRight, Shuffle, RefreshCw, Store, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCardData } from "@/components/StartupCard";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/contexts/FavoritesContext";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isStartupFavorite, toggleStartupFavorite } = useFavorites();
  const [pool, setPool] = useState<StartupCardData[]>([]);
  const [current, setCurrent] = useState<StartupCardData | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("startups")
      .select("id, slug, name, tagline, city, category, logo_url, badge, likes_count, supporters_count, delegation")
      .eq("status", "approved");
    if (loadError) {
      setError(loadError.message);
    } else if (data && data.length > 0) {
      setPool(data as StartupCardData[]);
      setCurrent(data[Math.floor(Math.random() * data.length)] as StartupCardData);
    } else {
      setPool([]);
      setCurrent(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("discover-startups-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "startups" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const next = () => {
    if (pool.length === 0) return;
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && pick.id === current?.id) {
      pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    }
    setCurrent(pick);
    setAnimKey((k) => k + 1);
  };

  const isFav = current ? isStartupFavorite(current.id) : false;

  const { data: products } = useQuery({
    queryKey: ["discover-products", current?.id],
    queryFn: async () => {
      if (!current?.id) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, images, price, currency")
        .eq("startup_id", current.id)
        .eq("is_published", true)
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!current?.id,
  });

  return (
    <PageLayout>
      <div className="container py-12">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-4xl font-bold md:text-5xl">
            <Heart className="mr-2 inline h-8 w-8 fill-rose-500/20 text-rose-500" />
            {t("discover.title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("discover.subtitle")}</p>
        </div>

        {loading ? (
          <p className="py-20 text-center text-muted-foreground">{t("common.loading")}</p>
        ) : error ? (
          <div className="py-20 text-center">
            <p className="text-destructive">Impossible de charger les créateurs.</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
            </Button>
          </div>
        ) : !current ? (
          <div className="mx-auto max-w-xl py-12">
            <EmptyState
              icon={Store}
              title="Aucun créateur à découvrir"
              description="Soyez le premier artisan ou créateur à exposer vos pièces sur la galerie Warsha !"
              action={{ label: "Devenir créateur", to: "/apply" }}
              secondaryAction={{ label: "Explorer les produits", to: "/products" }}
            />
          </div>
        ) : (
          <div key={animKey} className="mx-auto max-w-2xl animate-fade-in">
            <div className="overflow-hidden rounded-[32px] border border-border/80 bg-card shadow-xl transition">
              <div className="relative aspect-[4/5] bg-muted overflow-hidden">
                {current.logo_url ? (
                  <img
                    src={current.logo_url}
                    alt={current.name}
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center gradient-soft">
                    <Store className="h-16 w-16 text-primary/30" />
                  </div>
                )}

                {/* Favorite action button */}
                <button
                  type="button"
                  onClick={() => current && toggleStartupFavorite(current.id)}
                  className={cn(
                    "absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 shadow-md backdrop-blur transition hover:scale-110 active:scale-95",
                    isFav ? "text-rose-500" : "text-muted-foreground hover:text-foreground"
                  )}
                  title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                >
                  <Heart className={cn("h-5 w-5 transition-transform", isFav && "fill-rose-500 text-rose-500 scale-110")} />
                </button>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-6 sm:p-8">
                  <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">{current.name}</h2>
                  {current.tagline && <p className="mt-2 text-sm text-foreground/90 leading-relaxed sm:text-base">{current.tagline}</p>}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {(current.likes_count ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 text-white shadow-sm border border-white/10 text-xs font-semibold">
                        <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                        {current.likes_count} J'aime
                      </div>
                    )}
                    {(current.supporters_count ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 text-white shadow-sm border border-white/10 text-xs font-semibold">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        {current.supporters_count} Abonnés
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground sm:text-sm">
                    {current.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {current.city}
                        {current.delegation && <span>· {current.delegation}</span>}
                      </span>
                    )}
                    {current.category && <span>· {current.category}</span>}
                  </div>
                </div>
              </div>

              {products && products.length > 0 && (
                <div className="p-4 sm:p-6 bg-card border-t border-border/40">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5 text-foreground/90"><Sparkles className="h-4 w-4 text-primary" /> Top créations</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {products.map(p => (
                      <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-muted relative group border border-border/50">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                        ) : (
                          <Store className="h-6 w-6 m-auto mt-4 text-muted-foreground/30" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 p-4 sm:p-6 bg-card border-t border-border/60">
                <Button
                  className="flex-1 gradient-warm text-primary-foreground rounded-2xl h-12 text-sm font-semibold shadow-xs"
                  onClick={() => navigate(`/startup/${current.slug}`)}
                >
                  Visiter la boutique <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button variant="secondary" className="flex-1 rounded-2xl h-12 text-sm font-semibold group bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 border-none" onClick={next}>
                  <Heart className="mr-2 h-5 w-5 fill-rose-500/50 transition-transform group-hover:scale-125 group-active:scale-95" /> Un autre coup de cœur
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
