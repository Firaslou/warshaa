import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Heart, ShoppingBag, Store, Eye, MessageCircle, ExternalLink, Loader2,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCard, StartupCardData } from "@/components/StartupCard";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { openWhatsApp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

interface FavoriteProduct {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  discount_percentage: number | null;
  currency: string;
  images: string[];
  availability: "in_stock" | "arriving" | "out_of_stock";
  category: string | null;
  startup_id: string;
  startups: { slug: string; name: string; whatsapp_number: string | null; city: string | null } | null;
}

export default function ClientDashboard() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { favoriteProductIds, favoriteStartupIds, toggleProductFavorite, loading: favsLoading } = useFavorites();

  const [favoriteProducts, setFavoriteProducts] = useState<FavoriteProduct[]>([]);
  const [favoriteStartups, setFavoriteStartups] = useState<StartupCardData[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadDetails() {
      setLoadingItems(true);
      try {
        const prodIdArray = Array.from(favoriteProductIds);
        const startIdArray = Array.from(favoriteStartupIds);

        const [prodsRes, startsRes] = await Promise.all([
          prodIdArray.length > 0
            ? supabase
                .from("products")
                .select("id, name, description, price, discount_percentage, currency, images, availability, category, startup_id, startups(slug, name, whatsapp_number, city)")
                .in("id", prodIdArray)
            : Promise.resolve({ data: [] }),
          startIdArray.length > 0
            ? supabase
                .from("startups")
                .select("id, slug, name, tagline, city, category, logo_url, badge, likes_count, supporters_count, delegation")
                .in("id", startIdArray)
            : Promise.resolve({ data: [] }),
        ]);

        if (!cancelled) {
          setFavoriteProducts((prodsRes.data as any[]) ?? []);
          setFavoriteStartups((startsRes.data as any[]) ?? []);
        }
      } catch (err) {
        console.error("Failed to load favorite items:", err);
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    }

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [user, favoriteProductIds, favoriteStartupIds]);

  if (authLoading) {
    return (
      <PageLayout>
        <div className="container py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageLayout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const totalFavs = favoriteProductIds.size + favoriteStartupIds.size;

  return (
    <PageLayout>
      <div className="container max-w-6xl py-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 shadow-xs">
              <Heart className="h-6 w-6 fill-rose-500" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
                {t("dashboard.client.favorites") || "Mes Favoris"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Retrouvez toutes les créations et artisans que vous avez enregistrés ({totalFavs})
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="rounded-2xl shrink-0">
            <Link to="/products">Explorer la galerie</Link>
          </Button>
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="mb-8 h-11 rounded-2xl bg-muted/60 p-1">
            <TabsTrigger value="products" className="rounded-xl px-5 text-sm font-semibold gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span>Produits favoris</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.2 text-[11px] font-bold">
                {favoriteProductIds.size}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="creators" className="rounded-xl px-5 text-sm font-semibold gap-2">
              <Store className="h-4 w-4" />
              <span>Créateurs suivis</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.2 text-[11px] font-bold">
                {favoriteStartupIds.size}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            {loadingItems ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
                {t("common.loading")}
              </div>
            ) : favoriteProducts.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="Aucun produit favori pour le moment"
                description="Parcourez la galerie et cliquez sur le cœur ❤️ pour sauvegarder vos pièces artisanales préférées."
                action={{ label: "Explorer les produits", to: "/products" }}
                secondaryAction={{ label: "Découvrir les créateurs", to: "/creators" }}
                suggestions={["Poterie", "Céramique", "Tapis", "Cuir", "Bijoux"]}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteProducts.map((p) => {
                  const discount = p.discount_percentage ?? 0;
                  const finalPrice =
                    p.price != null && discount > 0 ? p.price * (1 - discount / 100) : p.price;

                  return (
                    <Card
                      key={p.id}
                      className="group overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs transition hover:shadow-md"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-muted">
                        {p.images?.[0] ? (
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            Pas d'image
                          </div>
                        )}

                        {discount > 0 && (
                          <div className="absolute left-3 top-3 rounded-lg bg-rose-600 px-2 py-1 text-xs font-black text-white shadow-md">
                            -{discount}%
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => void toggleProductFavorite(p.id)}
                          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-rose-500 shadow-sm backdrop-blur transition hover:scale-110 active:scale-95"
                          title="Retirer des favoris"
                        >
                          <Heart className="h-4 w-4 fill-rose-500" />
                        </button>
                      </div>

                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/product/${p.id}`}
                            className="font-serif text-base font-semibold leading-tight hover:text-primary transition-colors"
                          >
                            {p.name}
                          </Link>

                          {p.price != null && (
                            <div className="text-right whitespace-nowrap">
                              <span className="font-bold text-primary">
                                {finalPrice?.toFixed(3)} {p.currency || "TND"}
                              </span>
                              {discount > 0 && (
                                <span className="block text-[11px] text-muted-foreground line-through">
                                  {Number(p.price).toFixed(3)} {p.currency || "TND"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {p.startups && (
                          <Link
                            to={`/startup/${p.startups.slug}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            <Store className="h-3 w-3" />
                            <span>{p.startups.name}</span>
                            {p.startups.city && <span>· {p.startups.city}</span>}
                          </Link>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                          <Button asChild size="sm" variant="default" className="flex-1 gradient-warm text-primary-foreground rounded-xl text-xs">
                            <Link to={`/product/${p.id}`}>Voir le produit</Link>
                          </Button>

                          {p.startups?.whatsapp_number && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl text-xs"
                              onClick={() =>
                                openWhatsApp({
                                  phone: p.startups!.whatsapp_number!,
                                  productName: p.name,
                                  startupId: p.startup_id,
                                  productId: p.id,
                                  message: `Bonjour, je suis intéressé(e) par ${p.name} vu dans mes favoris sur Warsha.`,
                                })
                              }
                            >
                              WhatsApp
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Creators Tab */}
          <TabsContent value="creators">
            {loadingItems ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
                {t("common.loading")}
              </div>
            ) : favoriteStartups.length === 0 ? (
              <EmptyState
                icon={Store}
                title="Aucun créateur suivi pour le moment"
                description="Explorez les artisans, ateliers et jeunes talents tunisiens et cliquez sur le cœur ❤️ pour les retrouver ici."
                action={{ label: "Découvrir les créateurs", to: "/creators" }}
                secondaryAction={{ label: "Voir la carte des artisans", to: "/map" }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
                {favoriteStartups.map((s, i) => (
                  <StartupCard key={s.id} startup={s} index={i} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
