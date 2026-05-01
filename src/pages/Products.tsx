import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Eye, ShoppingBag, MessageCircle, Truck, ExternalLink, Search, X } from "lucide-react";
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
  const [governorate, setGovernorate] = useState("all");
  const [delegation, setDelegation] = useState("all");
  const [category, setCategory] = useState("all");
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [views, setViews] = useState<Record<string, number>>({});
  const [purchases, setPurchases] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,description,price,currency,images,availability,delivery_available,delivery_fee,category,delegation,startup_id,startups(slug,name,whatsapp_number,city)")
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

      setProducts([...real, ...demos]);

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
    if (governorate !== "all" && p.startups?.city !== governorate) return false;
    if (delegation !== "all" && p.delegation !== delegation) return false;
    if (category !== "all") {
      const label = t(`categoriesExt.${category}`);
      if (p.category !== label && p.category !== category) return false;
    }
    return true;
  });

  const hasFilters = search || governorate !== "all" || delegation !== "all" || category !== "all";
  const resetFilters = () => { setSearch(""); setGovernorate("all"); setDelegation("all"); setCategory("all"); };

  return (
    <PageLayout>
      <section className="container py-12">
        <h1 className="font-serif text-4xl font-bold">{t("products.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("products.subtitle")}</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("common.search")} value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-9" />
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

        {hasFilters && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-3 w-3" /> Réinitialiser
            </Button>
          </div>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.images?.[0] && (
                <Link to={`/product/${p.id}`} className="block aspect-square w-full overflow-hidden bg-muted">
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
                </Link>
              )}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/product/${p.id}`} className="font-serif text-lg font-semibold hover:text-primary">
                    {p.name}
                  </Link>
                  {p.price != null && (
                    <span className="whitespace-nowrap font-bold text-primary">{p.price} {p.currency}</span>
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
          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-muted-foreground">
              Aucun produit ne correspond à vos filtres.
            </p>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
