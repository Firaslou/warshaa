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

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["discover-products", current?.id],
    queryFn: async () => {
      if (!current?.id) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, images, price, currency, created_at")
        .eq("startup_id", current.id)
        .eq("is_published", true);
      if (error) throw error;
      const items = data || [];
      if (!items.length) return [];
      const ids = items.map((product) => product.id);
      const [viewsResult, likesResult] = await Promise.all([
        supabase.from("product_views").select("product_id").in("product_id", ids),
        supabase.from("product_likes").select("product_id").in("product_id", ids),
      ]);
      const tally = (rows: { product_id: string }[] | null) => {
        const counts: Record<string, number> = {};
        (rows ?? []).forEach((row) => { counts[row.product_id] = (counts[row.product_id] ?? 0) + 1; });
        return counts;
      };
      const views = tally(viewsResult.data);
      const likes = tally(likesResult.data);
      return items
        .map((product) => ({ ...product, views: views[product.id] ?? 0, likes: likes[product.id] ?? 0 }))
        .sort((a, b) => (b.likes * 3 + b.views) - (a.likes * 3 + a.views) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);
    },
    enabled: !!current?.id,
  });

  return (
    <PageLayout>
      <div className="container py-7 sm:py-10">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">
            <Heart className="mr-2 inline h-7 w-7 fill-rose-500/20 text-rose-500" />
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
          <div key={animKey} className="mx-auto max-w-5xl animate-fade-in">
            <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card transition">
              <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="relative h-56 overflow-hidden bg-muted sm:h-72 lg:h-full lg:min-h-[410px]">
                {current.logo_url ? (
                  <img
                    src={current.logo_url}
                    alt={current.name}
                    className="h-full w-full object-contain p-7 transition-transform duration-700 hover:scale-105 sm:p-10"
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

              </div>
                <div className="flex min-w-0 flex-col p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600"><Heart className="h-3.5 w-3.5 fill-current" />Coup de cœur Warsha</div><h2 className="font-serif text-2xl font-bold sm:text-3xl">{current.name}</h2>{current.tagline && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{current.tagline}</p>}</div>
                    <div className="flex gap-2 text-xs text-muted-foreground">{(current.likes_count ?? 0) > 0 && <span className="rounded-full bg-muted px-2.5 py-1"><Heart className="mr-1 inline h-3 w-3 text-rose-500" />{current.likes_count}</span>}{(current.supporters_count ?? 0) > 0 && <span className="rounded-full bg-muted px-2.5 py-1"><Sparkles className="mr-1 inline h-3 w-3 text-primary" />{current.supporters_count}</span>}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{current.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{current.city}{current.delegation && ` · ${current.delegation}`}</span>}{current.category && <span className="rounded-full bg-muted px-2 py-0.5">{current.category}</span>}</div>

                  <div className="mt-5 border-t border-border/60 pt-4">
                    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Ses produits les plus appréciés</h3>
                    {productsLoading ? <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((item) => <div key={item} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />)}</div> : products && products.length > 0 ? <div className="grid grid-cols-3 gap-2 sm:gap-3">{products.map((product) => <button key={product.id} type="button" onClick={() => navigate(`/product/${product.id}`)} className="group min-w-0 overflow-hidden rounded-xl border border-border/60 bg-background text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><div className="aspect-[4/3] overflow-hidden bg-muted">{product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Store className="h-6 w-6 text-muted-foreground/30" /></div>}</div><div className="p-2"><p className="truncate text-xs font-semibold">{product.name}</p><p className="mt-0.5 text-[11px] font-medium text-primary">{product.price != null ? `${Number(product.price).toFixed(3)} ${product.currency}` : "Voir le produit"}</p></div></button>)}</div> : <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-xs text-muted-foreground">Ce créateur n’a pas encore publié de produit.</p>}
                  </div>

                  <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
                    <Button className="flex-1 rounded-xl gradient-warm text-primary-foreground" onClick={() => navigate(`/startup/${current.slug}`)}>Voir le profil <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                    <Button variant="outline" className="flex-1 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={next}><Shuffle className="mr-2 h-4 w-4" />Trouver un autre coup de cœur</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
