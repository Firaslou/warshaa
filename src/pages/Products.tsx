import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Eye, ShoppingBag, MessageCircle, Truck, ExternalLink } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsApp } from "@/lib/whatsapp";
import { useAuth } from "@/contexts/AuthContext";

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
  startup_id: string;
  startups: { slug: string; name: string; whatsapp_number: string | null } | null;
}

export default function Products() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [views, setViews] = useState<Record<string, number>>({});
  const [purchases, setPurchases] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,description,price,currency,images,availability,delivery_available,delivery_fee,startup_id,startups(slug,name,whatsapp_number)")
        .order("created_at", { ascending: false })
        .limit(60);
      setProducts((data ?? []) as any);

      // Counts
      const ids = (data ?? []).map((p: any) => p.id);
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

  const filtered = products.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.startups?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageLayout>
      <section className="container py-12">
        <h1 className="font-serif text-4xl font-bold">{t("products.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("products.subtitle")}</p>

        <div className="mt-6 max-w-md">
          <Input placeholder={t("common.search")} value={search} onChange={(e)=>setSearch(e.target.value)} />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.images?.[0] && (
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg font-semibold">{p.name}</h3>
                  {p.price != null && (
                    <span className="whitespace-nowrap font-bold text-primary">{p.price} {p.currency}</span>
                  )}
                </div>
                {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}

                <div className="flex flex-wrap gap-2 text-xs">
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
                  <Button size="sm" variant="ghost" onClick={() => toggleLike(p.id)} disabled={!user}>
                    <Heart className="h-4 w-4" />
                  </Button>
                  {p.startups?.whatsapp_number && (
                    <Button size="sm" className="gradient-warm text-primary-foreground"
                      onClick={() => openWhatsApp(p.startups!.whatsapp_number!, p.name, p.id, p.startup_id)}>
                      WhatsApp
                    </Button>
                  )}
                  {user && p.startups && (
                    <Button size="sm" variant="outline" onClick={() => confirmPurchase(p)}>
                      <ShoppingBag className="mr-1 h-4 w-4" />{t("products.iBoughtIt")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled title={t("products.chatPrivate")}>
                    <MessageCircle className="h-4 w-4" />
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
            <p className="col-span-full py-12 text-center text-muted-foreground">—</p>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
