import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Heart, Eye, ShoppingBag, MessageCircle, Truck, ExternalLink, X, SearchCheck, Loader2, Sparkles, Filter,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsApp } from "@/lib/whatsapp";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { TUNISIA_GOVERNORATES, TUNISIA_DELEGATIONS, CATEGORIES_KEYS, type Governorate } from "@/lib/tunisia";
import { SmartSearchInput } from "@/components/search/SmartSearchInput";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCardSkeleton } from "@/components/skeletons/ProductCardSkeleton";
import { fuzzyMatch } from "@/lib/search-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  discount_percentage: number | null;
  currency: string;
  images: string[];
  availability: "in_stock" | "arriving" | "out_of_stock";
  delivery_available: boolean;
  delivery_fee: number | null;
  category: string | null;
  delegation: string | null;
  startup_id: string;
  startups: { slug: string; name: string; whatsapp_number: string | null; city: string | null } | null;
  isDemo?: boolean;
}

const AVAILABILITY_RANK: Record<string, number> = { in_stock: 0, arriving: 1, out_of_stock: 2 };

const effectivePrice = (product: ProductRow) => {
  if (product.price == null) return null;
  const discount = product.discount_percentage ?? 0;
  return discount > 0 ? product.price * (1 - discount / 100) : product.price;
};

export default function Products() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isProductFavorite, toggleProductFavorite } = useFavorites();
  const [params, setParams] = useSearchParams();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [aiFilters, setAiFilters] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [views, setViews] = useState<Record<string, number>>({});
  const [purchases, setPurchases] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // URL Query Params state synchronization
  const search = params.get("q") ?? "";
  const governorate = params.get("gov") ?? "all";
  const delegation = params.get("del") ?? "all";
  const category = params.get("category") ?? "all";
  const sort = params.get("sort") ?? "relevance";
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";

  const updateParam = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === "all" || !value) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );
  };

  const setSearch = (val: string) => {
    updateParam("q", val);
    if (aiFilters) setAiFilters(null);
  };
  const setGovernorate = (val: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val === "all" || !val) next.delete("gov");
        else next.set("gov", val);
        next.delete("del"); // reset delegation
        return next;
      },
      { replace: true }
    );
  };
  const setDelegation = (val: string) => updateParam("del", val);
  const setCategory = (val: string) => updateParam("category", val);
  const setSort = (val: string) => updateParam("sort", val);
  const setPriceRange = (min: string, max: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (min) next.set("minPrice", min);
        else next.delete("minPrice");

        if (max) next.set("maxPrice", max);
        else next.delete("maxPrice");
        return next;
      },
      { replace: true }
    );
  };

  const loadProducts = async () => {
    setLoading(true);
    setLoadError(null);
    const productFields = "id,name,description,price,discount_percentage,currency,images,availability,delivery_available,delivery_fee,category,delegation,startup_id,startups(slug,name,whatsapp_number,city)";
    let { data, error } = await supabase
      .from("products")
      .select(productFields)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(150);

    if (error && /is_published/i.test(error.message)) {
      const legacyResult = await supabase
        .from("products")
        .select(productFields)
        .order("created_at", { ascending: false })
        .limit(150);
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const real = (data ?? []) as any as ProductRow[];

    const productsWithOfficialDiscounts = real.map((product: any) => ({
      ...product,
      discount_percentage: product.discount_percentage ?? 0,
    }));

    setProducts(productsWithOfficialDiscounts);

    // Counts
    const ids = real.map((p) => p.id);
    if (ids.length) {
      const [lk, vw, pc] = await Promise.all([
        supabase.from("product_likes").select("product_id").in("product_id", ids),
        supabase.from("product_views").select("product_id").in("product_id", ids),
        supabase.from("purchase_confirmations").select("product_id").in("product_id", ids),
      ]);
      const tally = (rows: any[] | null) => {
        const m: Record<string, number> = {};
        (rows ?? []).forEach((r) => (m[r.product_id] = (m[r.product_id] ?? 0) + 1));
        return m;
      };
      setLikes(tally(lk.data));
      setViews(tally(vw.data));
      setPurchases(tally(pc.data));
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadProducts();
    const channel = supabase
      .channel("products-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => void loadProducts())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_likes" }, () => void loadProducts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const confirmPurchase = async (p: ProductRow) => {
    if (!user) {
      toast.info("Connectez-vous pour confirmer un achat.");
      return;
    }
    await supabase.from("purchase_confirmations").insert({
      user_id: user.id,
      product_id: p.id,
      startup_id: p.startup_id,
    });
    setPurchases((m) => ({ ...m, [p.id]: (m[p.id] ?? 0) + 1 }));
    toast.success("Achat enregistré avec succès !");
  };

  const delegationsForGov = useMemo(
    () => (governorate === "all" ? [] : TUNISIA_DELEGATIONS[governorate as Governorate] ?? []),
    [governorate]
  );

  const suggestionsPool = useMemo(() => {
    const list: Array<{ label: string; category?: string }> = [];
    products.forEach((p) => {
      if (p.name) list.push({ label: p.name, category: p.category || undefined });
      if (p.startups?.name) list.push({ label: p.startups.name });
    });
    return list;
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      // Fuzzy & typo tolerant match on name, description, and startup
      if (search.trim()) {
        const textTarget = `${p.name} ${p.description ?? ""} ${p.category ?? ""} ${p.startups?.name ?? ""}`;
        if (!fuzzyMatch(search, textTarget)) return false;
      }

      if (aiFilters) {
        const hay = `${p.name} ${p.description ?? ""} ${p.category ?? ""} ${p.startups?.name ?? ""}`.toLowerCase();
        const terms: string[] = [
          ...(Array.isArray(aiFilters.keywords) ? aiFilters.keywords : []),
          aiFilters.color,
          aiFilters.category,
        ]
          .filter((s: any) => typeof s === "string" && s.trim().length > 1)
          .map((s: string) => s.toLowerCase());
        if (terms.length && !terms.some((t) => hay.includes(t))) return false;
        if (typeof aiFilters.max_price === "number" && (p.price ?? Infinity) > aiFilters.max_price) return false;
        if (typeof aiFilters.min_price === "number" && (p.price ?? -Infinity) < aiFilters.min_price) return false;
        if (aiFilters.delivery_required && !p.delivery_available) return false;
        if (aiFilters.city) {
          const c = String(aiFilters.city).toLowerCase();
          const loc = `${p.startups?.city ?? ""} ${p.delegation ?? ""}`.toLowerCase();
          if (!loc.includes(c)) return false;
        }
      }

      if (governorate !== "all" && p.startups?.city !== governorate) return false;
      if (delegation !== "all" && p.delegation !== delegation) return false;
      if (category !== "all") {
        const label = t(`categoriesExt.${category}`);
        if (p.category !== label && p.category !== category) return false;
      }

      const price = effectivePrice(p);
      if (price !== null) {
        if (minPrice && price < parseFloat(minPrice)) return false;
        if (maxPrice && price > parseFloat(maxPrice)) return false;
      }

      return true;
    });
  }, [products, search, aiFilters, governorate, delegation, category, minPrice, maxPrice, t]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "newest":
          return b.id > a.id ? 1 : -1;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "price_asc":
          return (effectivePrice(a) ?? Infinity) - (effectivePrice(b) ?? Infinity);
        case "price_desc":
          return (effectivePrice(b) ?? -Infinity) - (effectivePrice(a) ?? -Infinity);
        case "in_stock":
          return (AVAILABILITY_RANK[a.availability] ?? 9) - (AVAILABILITY_RANK[b.availability] ?? 9);
        default:
          return (likes[b.id] ?? 0) + (views[b.id] ?? 0) - ((likes[a.id] ?? 0) + (views[a.id] ?? 0));
      }
    });
  }, [filtered, sort, likes, views]);

  const hasFilters = search || governorate !== "all" || delegation !== "all" || category !== "all" || minPrice || maxPrice || aiFilters;
  const resetFilters = () => {
    setParams({}, { replace: true });
    setAiFilters(null);
  };

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
      <section className="container py-10">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">{t("products.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("products.subtitle")}</p>
        </div>

        {/* Smart Search Bar & Filter Controls */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SmartSearchInput
            value={search}
            onChange={setSearch}
            suggestionsPool={suggestionsPool}
            placeholder="Ex : robe bleue, poterie, moins de 100dt..."
            aiLoading={aiLoading}
            onRunAiSearch={runAiSearch}
          />

          <Select value={governorate} onValueChange={setGovernorate}>
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

          <Select value={delegation} onValueChange={setDelegation} disabled={governorate === "all"}>
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

          <Select value={category} onValueChange={setCategory}>
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

          {/* Price Range Filter */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min TND"
              value={minPrice}
              onChange={(e) => setPriceRange(e.target.value, maxPrice)}
              className="h-11 rounded-2xl text-sm"
              min="0"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max TND"
              value={maxPrice}
              onChange={(e) => setPriceRange(minPrice, e.target.value)}
              className="h-11 rounded-2xl text-sm"
              min="0"
            />
          </div>
        </div>

        {/* AI Filters pills */}
        {aiFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <SearchCheck className="h-4 w-4 text-primary" />
            <span className="font-medium text-muted-foreground">Filtres intelligents :</span>
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
            {aiFilters.max_price && (
              <Badge variant="outline" className="rounded-full">
                ≤ {aiFilters.max_price} TND
              </Badge>
            )}
            {aiFilters.min_price && (
              <Badge variant="outline" className="rounded-full">
                ≥ {aiFilters.min_price} TND
              </Badge>
            )}
            {aiFilters.city && (
              <Badge variant="outline" className="rounded-full">
                {aiFilters.city}
              </Badge>
            )}
            {aiFilters.delivery_required && (
              <Badge variant="outline" className="rounded-full">
                Livraison disponible
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 rounded-full px-2" onClick={() => setAiFilters(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Results Count & Sorting */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {sorted.length} produit{sorted.length > 1 ? "s" : ""}
            </span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <X className="mr-1 h-3 w-3" /> Réinitialiser les filtres
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Trier par :</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-9 w-[200px] rounded-xl text-xs shadow-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="relevance">Pertinence & Popularité</SelectItem>
                <SelectItem value="newest">Nouveaux produits</SelectItem>
                <SelectItem value="name_asc">Nom : A → Z</SelectItem>
                <SelectItem value="name_desc">Nom : Z → A</SelectItem>
                <SelectItem value="price_asc">Prix : croissant</SelectItem>
                <SelectItem value="price_desc">Prix : décroissant</SelectItem>
                <SelectItem value="in_stock">En stock d'abord</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products Grid / States */}
        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : loadError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-destructive">Impossible de charger les produits.</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={loadProducts}>
              Réessayer
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={ShoppingBag}
              title="Aucun produit ne correspond à vos critères"
              description="Essayez d'ajuster ou d'élargir vos filtres de recherche pour découvrir les créations artisanales."
              action={{
                label: "Réinitialiser tous les filtres",
                onClick: resetFilters,
              }}
              secondaryAction={{
                label: "Découvrir tous les créateurs",
                to: "/creators",
              }}
              suggestions={["Poterie", "Céramique", "Tapis", "Cuir", "Huile d'olive", "Bijoux"]}
              onSelectSuggestion={(s) => setSearch(s)}
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p) => {
              const isFav = isProductFavorite(p.id);
              const discount = p.discount_percentage ?? 0;
              const finalPrice =
                p.price != null && discount > 0 ? p.price * (1 - discount / 100) : p.price;

              return (
                <Card
                  key={p.id}
                  className="group overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs transition hover:shadow-md"
                >
                  {p.images?.[0] && (
                    <Link to={`/product/${p.id}`} className="relative block aspect-square w-full overflow-hidden bg-muted">
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />

                      {discount > 0 && (
                        <div className="absolute left-3 top-3 rounded-xl bg-rose-600 px-2.5 py-1 text-xs font-black text-white shadow-md animate-pulse">
                          -{discount}%
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void toggleProductFavorite(p.id);
                        }}
                        className={cn(
                          "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur transition hover:scale-110 active:scale-95",
                          isFav ? "text-rose-500" : "text-muted-foreground hover:text-foreground"
                        )}
                        title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <Heart className={cn("h-4 w-4 transition-transform", isFav && "fill-rose-500 text-rose-500 scale-110")} />
                      </button>
                    </Link>
                  )}

                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/product/${p.id}`}
                        className="font-serif text-lg font-semibold leading-tight hover:text-primary transition-colors"
                      >
                        {p.name}
                      </Link>

                      {p.price != null && (
                        <div className="flex flex-col items-end whitespace-nowrap">
                          <span className={cn("font-bold", discount > 0 ? "text-rose-600" : "text-primary")}>
                            {finalPrice?.toFixed(3)} TND
                          </span>
                          {discount > 0 && (
                            <span className="text-[11px] text-muted-foreground line-through">
                              {Number(p.price).toFixed(3)} TND
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {p.description && <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">{p.description}</p>}

                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {p.category && <Badge variant="secondary" className="rounded-full text-[11px]">{p.category}</Badge>}
                      {p.delegation && <Badge variant="outline" className="rounded-full text-[11px]">{p.delegation}</Badge>}
                      <Badge variant="secondary" className="rounded-full text-[11px]">{t(`products.availability.${p.availability}`)}</Badge>
                      {p.delivery_available ? (
                        <Badge variant="outline" className="gap-1 rounded-full text-[11px]">
                          <Truck className="h-3 w-3" />
                          {t("products.delivery")}
                          {p.delivery_fee != null && ` · ${p.delivery_fee} TND`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-[11px]">{t("products.noDelivery")}</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {views[p.id] ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-rose-500" />
                        {likes[p.id] ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="h-3.5 w-3.5" />
                        {purchases[p.id] ?? 0}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                      <Button
                        size="sm"
                        variant={isFav ? "secondary" : "outline"}
                        onClick={() => void toggleProductFavorite(p.id)}
                        className="rounded-xl h-9 px-3"
                        title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <Heart className={cn("h-4 w-4", isFav && "fill-rose-500 text-rose-500")} />
                      </Button>

                      {p.startups?.whatsapp_number && (
                        <Button
                          size="sm"
                          className="gradient-warm text-primary-foreground rounded-xl h-9 text-xs flex-1"
                          onClick={() =>
                            openWhatsApp({
                              phone: p.startups!.whatsapp_number!,
                              productName: p.name,
                              startupId: p.startup_id,
                              productId: p.id,
                              message: t("startup.whatsappMessage", { product: p.name }),
                            })
                          }
                        >
                          WhatsApp
                        </Button>
                      )}

                      {user && p.startups && !p.isDemo && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl h-9 text-xs"
                          onClick={() => confirmPurchase(p)}
                        >
                          <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                          {t("products.iBoughtIt")}
                        </Button>
                      )}

                      <Button size="sm" variant="ghost" asChild className="rounded-xl h-9 w-9 p-0" title={t("products.chatPrivate")}>
                        <Link to={`/product/${p.id}`}>
                          <MessageCircle className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>

                    {p.startups && (
                      <Link
                        to={`/startup/${p.startups.slug}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> {t("products.viewCreator")} — {p.startups.name}
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
