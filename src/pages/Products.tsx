import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Eye, ShoppingBag, MessageCircle, Truck, ExternalLink, Search, X, Sparkles, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsApp } from "@/lib/whatsapp";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_PRODUCTS, DEMO_STARTUPS } from "@/lib/demo";
import { TUNISIA_GOVERNORATES, TUNISIA_DELEGATIONS, CATEGORIES_KEYS, type Governorate } from "@/lib/tunisia";
import { useMemo } from "react";

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

export default function Products() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [aiFilters, setAiFilters] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [governorate, setGovernorate] = useState("all");
  const [delegation, setDelegation] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [views, setViews] = useState<Record<string, number>>({});
  const [purchases, setPurchases] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,description,price,discount_percentage,currency,images,availability,delivery_available,delivery_fee,category,delegation,startup_id,startups(slug,name,whatsapp_number,city)")
        .order("created_at", { ascending: false })
        .limit(120);

      const real = (data ?? []) as any as ProductRow[];

      // Always show demo products as fallback / examples so the page is never empty
      const demos: ProductRow[] = DEMO_PRODUCTS.map((p) => {
        const s = DEMO_STARTUPS.find((s) => s.slug === p.startup_slug);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          discount_percentage: null,
          currency: p.currency,
          images: p.images,
          availability: "in_stock",
          delivery_available: p.delivery_available,
          delivery_fee: p.delivery_fee,
          category: p.category,
          delegation: p.delegation,
          startup_id: s?.id ?? "demo",
          startups: s ? { slug: s.slug, name: s.name, whatsapp_number: null, city: s.city ?? null } : null,
          isDemo: true,
        };
      });

      const allProducts = [...real, ...demos];

      // On injecte les pourcentages de solde stockés dans le navigateur
      const productsWithLocalDiscounts = allProducts.map((product: any) => {
        const localDiscount = localStorage.getItem(`discount_${product.id}`);
        return {
          ...product,
          // Si on trouve un solde dans le localStorage, on le prend, sinon on garde la valeur d'origine
          discount_percentage: localDiscount ? Number(localDiscount) : (product.discount_percentage ?? 0)
        };
      });

      // On envoie la liste finale enrichie à l'affichage
      setProducts(productsWithLocalDiscounts);

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
    })();
  }, []);

  const toggleLike = async (productId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("product_likes").select("id").eq("user_id", user.id).eq("product_id", productId).maybeSingle();
    if (existing) {
      await supabase.from("product_likes").delete().eq("id", existing.id);
      setLikes((m) => ({ ...m, [productId]: Math.max(0, (m[productId] ?? 1) - 1) }));
    } else {
      await supabase.from("product_likes").insert({ user_id: user.id, product_id: productId });
      setLikes((m) => ({ ...m, [productId]: (m[productId] ?? 0) + 1 }));
    }
  };

  const confirmPurchase = async (p: ProductRow) => {
    if (!user) return;
    await supabase.from("purchase_confirmations").insert({ user_id: user.id, product_id: p.id, startup_id: p.startup_id });
    setPurchases((m) => ({ ...m, [p.id]: (m[p.id] ?? 0) + 1 }));
  };

  const delegationsForGov = useMemo(
    () => (governorate === "all" ? [] : TUNISIA_DELEGATIONS[governorate as Governorate] ?? []),
    [governorate]
  );

  const filtered = products.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      const hay = `${p.name} ${p.description ?? ""} ${p.startups?.name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (aiFilters) {
      const hay = `${p.name} ${p.description ?? ""} ${p.category ?? ""} ${p.startups?.name ?? ""}`.toLowerCase();
      const terms: string[] = [
        ...(Array.isArray(aiFilters.keywords) ? aiFilters.keywords : []),
        aiFilters.color,
        aiFilters.category,
      ].filter((s: any) => typeof s === "string" && s.trim().length > 1).map((s: string) => s.toLowerCase());
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
    return true;
  });

  const availabilityRank: Record<string, number> = { in_stock: 0, arriving: 1, out_of_stock: 2 };
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "newest":
        return (b.id > a.id ? 1 : -1); // real rows come first (already sorted by created_at desc); demos last
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "price_asc":
        return (a.price ?? Infinity) - (b.price ?? Infinity);
      case "price_desc":
        return (b.price ?? -Infinity) - (a.price ?? -Infinity);
      case "in_stock":
        return (availabilityRank[a.availability] ?? 9) - (availabilityRank[b.availability] ?? 9);
      default:
        // relevance: most liked + viewed first
        return ((likes[b.id] ?? 0) + (views[b.id] ?? 0)) - ((likes[a.id] ?? 0) + (views[a.id] ?? 0));
    }
  });

  const hasFilters = search || governorate !== "all" || delegation !== "all" || category !== "all";
  const resetFilters = () => { setSearch(""); setGovernorate("all"); setDelegation("all"); setCategory("all"); setAiFilters(null); };

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
      <section className="container py-12">
        <h1 className="font-serif text-4xl font-bold">{t("products.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("products.subtitle")}</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder='Ex : "robe traditionnelle bleue moins de 100dt"'
              value={search}
              onChange={(e)=>{ setSearch(e.target.value); if (aiFilters) setAiFilters(null); }}
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
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </button>
          </div>
          <Select value={governorate} onValueChange={(v) => { setGovernorate(v); setDelegation("all"); }}>
            <SelectTrigger><SelectValue placeholder="Gouvernorat" /></SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">{t("common.all")} — Gouvernorat</SelectItem>
              {TUNISIA_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={delegation} onValueChange={setDelegation} disabled={governorate === "all"}>
            <SelectTrigger>
              <SelectValue placeholder={governorate === "all" ? "Choisir un gouvernorat" : "Délégation"} />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">{t("common.all")} — Délégation</SelectItem>
              {delegationsForGov.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder={t("common.category")} /></SelectTrigger>
            <SelectContent className="bg-popover max-h-72">
              <SelectItem value="all">{t("common.all")} — {t("common.category")}</SelectItem>
              {CATEGORIES_KEYS.map((k) => (
                <SelectItem key={k} value={k}>{t(`categoriesExt.${k}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {aiFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Filtres IA :</span>
            {Array.isArray(aiFilters.keywords) && aiFilters.keywords.map((k: string) => (
              <Badge key={k} variant="secondary">{k}</Badge>
            ))}
            {aiFilters.color && <Badge variant="outline">{aiFilters.color}</Badge>}
            {aiFilters.max_price && <Badge variant="outline">≤ {aiFilters.max_price} TND</Badge>}
            {aiFilters.min_price && <Badge variant="outline">≥ {aiFilters.min_price} TND</Badge>}
            {aiFilters.city && <Badge variant="outline">{aiFilters.city}</Badge>}
            {aiFilters.delivery_required && <Badge variant="outline">Livraison</Badge>}
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setAiFilters(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {sorted.length} produit{sorted.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Trier par :</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="relevance">Pertinence</SelectItem>
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

        {hasFilters && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{sorted.length} résultat{sorted.length > 1 ? "s" : ""}</span>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-3 w-3" /> Réinitialiser
            </Button>
          </div>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.images?.[0] && (
                <Link to={`/product/${p.id}`} className="relative block aspect-square w-full overflow-hidden bg-muted">
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
    
                  {/* Badge rouge de réduction */}
                  {p.discount_percentage && p.discount_percentage > 0 && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-black px-2 py-1 rounded-md shadow-md z-10 animate-pulse">
                      -{p.discount_percentage}%
                    </div>
                  )}
                </Link>
              )}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/product/${p.id}`} className="font-serif text-lg font-semibold hover:text-primary">
                    {p.name}
                  </Link>
                  {p.price != null && (
                    p.discount_percentage && p.discount_percentage > 0 ? (
                      <div className="flex flex-col items-end">
                        {/* Nouveau prix calculé affiché en rouge */}
                        <span className="whitespace-nowrap font-bold text-red-600">
                          {(p.price * (1 - p.discount_percentage / 100)).toFixed(3)} TND
                        </span>
                        {/* Ancien prix barré */}
                        <span className="text-xs text-muted-foreground line-through">
                        {Number(p.price).toFixed(3)} TND
                        </span>
                        {/* Petit badge de réduction */}
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 mt-0.5">
                          -{p.discount_percentage}%
                        </span>
                      </div>
                    ) : (
                      /* Prix normal s'il n'y a pas de solde */
                      <span className="whitespace-nowrap font-bold text-primary">{Number(p.price).toFixed(3)} TND</span>
                    )
                  )}
                </div>
                {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}

                <div className="flex flex-wrap gap-2 text-xs">
                  {p.category && <Badge variant="secondary">{p.category}</Badge>}
                  {p.delegation && <Badge variant="outline">{p.delegation}</Badge>}
                  <Badge variant="secondary">{t(`products.availability.${p.availability}`)}</Badge>
                  {p.delivery_available
                    ? <Badge variant="outline" className="gap-1"><Truck className="h-3 w-3"/>{t("products.delivery")}{p.delivery_fee != null && ` · ${p.delivery_fee} TND`}</Badge>
                    : <Badge variant="outline">{t("products.noDelivery")}</Badge>}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3"/>{views[p.id] ?? 0}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3"/>{likes[p.id] ?? 0}</span>
                  <span className="flex items-center gap-1"><ShoppingBag className="h-3 w-3"/>{purchases[p.id] ?? 0}</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleLike(p.id)} disabled={!user || p.isDemo}>
                    <Heart className="h-4 w-4" />
                  </Button>
                  {p.startups?.whatsapp_number && (
                    <Button size="sm" className="gradient-warm text-primary-foreground"
                      onClick={() => openWhatsApp({
                        phone: p.startups!.whatsapp_number!,
                        productName: p.name,
                        startupId: p.startup_id,
                        productId: p.id,
                        message: t("startup.whatsappMessage", { product: p.name }),
                      })}>
                      WhatsApp
                    </Button>
                  )}
                  {user && p.startups && !p.isDemo && (
                    <Button size="sm" variant="outline" onClick={() => confirmPurchase(p)}>
                      <ShoppingBag className="mr-1 h-4 w-4" />{t("products.iBoughtIt")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" asChild title={t("products.chatPrivate")}>
                    <Link to={`/product/${p.id}`}><MessageCircle className="h-4 w-4" /></Link>
                  </Button>
                </div>

                {p.startups && (
                  <Link to={`/startup/${p.startups.slug}`} className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3"/> {t("products.viewCreator")} — {p.startups.name}
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
          {sorted.length === 0 && (
            <p className="col-span-full py-12 text-center text-muted-foreground">
              Aucun produit ne correspond à vos filtres.
            </p>
          )}
        </div>
      </section>
      <button 
        onClick={async () => {
          try {
            // Une simple requête de sélection suffit souvent à réveiller le cache du client
            await supabase.from('products').select('id').limit(1);
            alert("Requête de test envoyée ! Si la colonne rouge apparaît toujours lors de l'ajout, fais un rafraîchissement complet (F5).");
          } catch (e) {
            alert("Erreur lors de la tentative. Rafraîchis simplement la page (F5).");
          }
        }}
        className="fixed bottom-4 right-4 bg-black text-white text-xs px-3 py-2 rounded shadow z-50"
      >
        🔄 Forcer recharge Cache Supabase
      </button>
    </PageLayout>
  );
}
