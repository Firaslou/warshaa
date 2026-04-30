import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MapPin, BadgeCheck, Sparkles, Award, Heart, MessageCircle, Star,
  Instagram, Facebook, Eye, ShoppingBag, TrendingUp, Radio, Lock, Truck, LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/layout/PageLayout";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { DEMO_STARTUPS, getDemoProductsForStartup } from "@/lib/demo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Startup {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  creator_story?: string | null;
  city?: string | null;
  delegation?: string | null;
  category?: string | null;
  cover_url?: string | null;
  logo_url?: string | null;
  whatsapp_number?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  badge: "new" | "verified" | "certified";
  likes_count: number;
  supporters_count: number;
  is_live?: boolean;
  live_started_at?: string | null;
  last_post_at?: string | null;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency: string;
  images: string[];
  created_at?: string;
  delivery_available?: boolean;
  delivery_fee?: number | null;
  category?: string | null;
  delegation?: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  photo_url?: string | null;
  created_at: string;
  user_id: string;
}

export default function StartupDetail() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [startup, setStartup] = useState<Startup | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [stats, setStats] = useState({ views: 0, purchases: 0, clicks: 0 });
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: s } = await supabase.from("startups").select("*").eq("slug", slug).maybeSingle();
      // Si un startup réel existe ET que ce n'est pas un slug de démo, afficher le réel.
      const demo = DEMO_STARTUPS.find((d) => d.slug === slug);
      if (s && !demo) {
        setStartup(s as Startup);
        const [{ data: prods }, { data: revs }] = await Promise.all([
          supabase.from("products").select("*").eq("startup_id", s.id).order("created_at", { ascending: false }),
          supabase.from("reviews").select("*").eq("startup_id", s.id).order("created_at", { ascending: false }),
        ]);
        setProducts((prods as Product[]) ?? []);
        setReviews((revs as Review[]) ?? []);
        // Stats détaillées
        const productIds = (prods ?? []).map((p: any) => p.id);
        const [viewsRes, purchasesRes, clicksRes] = await Promise.all([
          productIds.length > 0
            ? supabase.from("product_views").select("id", { count: "exact", head: true }).in("product_id", productIds)
            : Promise.resolve({ count: 0 } as any),
          supabase.from("purchase_confirmations").select("id", { count: "exact", head: true }).eq("startup_id", s.id),
          supabase.from("purchase_clicks").select("id", { count: "exact", head: true }).eq("startup_id", s.id),
        ]);
        setStats({
          views: viewsRes.count ?? 0,
          purchases: purchasesRes.count ?? 0,
          clicks: clicksRes.count ?? 0,
        });
        if (user) {
          const { data: fav } = await supabase
            .from("favorites").select("id").eq("user_id", user.id).eq("startup_id", s.id).maybeSingle();
          setIsFavorite(!!fav);
        }
      } else {
        // Fallback to demo (ou slug de démo prioritaire)
        if (demo) {
          setIsDemo(true);
          setStartup({
            ...demo,
            description: "Une marque pleine de passion et d'authenticité.",
            creator_story: "Cette marque est née d'une envie de partager un savoir-faire transmis de génération en génération. Chaque pièce raconte une histoire.",
            whatsapp_number: "+21620000000",
            logo_url: null,
            instagram_url: null,
            facebook_url: null,
          } as Startup);
          // Produits de démo enrichis (multi-photos, catégorie, délégation, livraison)
          const demoProds = getDemoProductsForStartup(demo.slug);
          setProducts(
            demoProds.length > 0
              ? demoProds.map((p) => ({
                  id: p.id,
                  name: p.name,
                  description: p.description,
                  price: p.price,
                  currency: p.currency,
                  images: p.images,
                  delivery_available: p.delivery_available,
                  delivery_fee: p.delivery_fee,
                  category: p.category,
                  delegation: p.delegation,
                }))
              : [],
          );
        }
      }
      setLoading(false);
    })();
  }, [slug, user]);

  const toggleFavorite = async () => {
    if (!user) { toast.info(t("apply.needAccount")); return; }
    if (!startup) return;
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("startup_id", startup.id);
      setIsFavorite(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, startup_id: startup.id });
      setIsFavorite(true);
    }
  };

  const buy = (productName: string, productId?: string) => {
    if (isDemo) {
      toast.info("Aperçu de démonstration — aucun message ne sera envoyé.");
      return;
    }
    if (!user) { toast.info("Connectez-vous pour contacter ce créateur."); return; }
    if (!startup?.whatsapp_number) return;
    openWhatsApp({
      phone: startup.whatsapp_number,
      productName,
      startupId: startup.id,
      productId,
      message: t("startup.whatsappMessage", { product: productName }),
    });
  };

  const openChat = () => {
    if (isDemo) {
      toast.info("Aperçu de démonstration — le chat privé sera disponible avec les vrais créateurs.");
      return;
    }
    if (!user) { toast.info(t("apply.needAccount")); return; }
    setChatOpen(true);
  };

  if (loading) return <PageLayout><div className="container py-20 text-center">{t("common.loading")}</div></PageLayout>;
  if (!startup) return <PageLayout><div className="container py-20 text-center">{t("notFound.title")}</div></PageLayout>;

  const badgeMeta = {
    new: { label: t("startup.new"), icon: Sparkles, className: "bg-warning/15 text-warning-foreground border-warning/30" },
    verified: { label: t("startup.verified"), icon: BadgeCheck, className: "bg-success/15 text-success border-success/30" },
    certified: { label: t("startup.certified"), icon: Award, className: "bg-primary/15 text-primary border-primary/30" },
  }[startup.badge];
  const Icon = badgeMeta.icon;

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const conversionRate = stats.clicks > 0 ? Math.round((stats.purchases / stats.clicks) * 100) : 0;
  const recentPosts = products.slice(0, 6);

  return (
    <PageLayout>
      {/* HERO */}
      <section className="relative">
        <div className="aspect-[21/9] w-full overflow-hidden bg-muted md:aspect-[3/1]">
          {startup.cover_url && (
            <img src={startup.cover_url} alt={startup.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="container -mt-16 pb-8 md:-mt-24">
          <div className="rounded-2xl bg-card p-6 shadow-elegant md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("border", badgeMeta.className)}>
                    <Icon className="mr-1 h-3 w-3" /> {badgeMeta.label}
                  </Badge>
                  {startup.is_live && (
                    <Badge className="border-0 bg-destructive text-destructive-foreground animate-pulse">
                      <Radio className="mr-1 h-3 w-3" /> LIVE
                    </Badge>
                  )}
                </div>
                <h1 className="font-serif text-4xl font-bold md:text-5xl">{startup.name}</h1>
                {startup.tagline && <p className="mt-2 text-lg text-muted-foreground">{startup.tagline}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {startup.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {startup.city}
                      {startup.delegation && <span className="text-muted-foreground/70">· {startup.delegation}</span>}
                    </span>
                  )}
                  {startup.category && <span>· {startup.category}</span>}
                  <span className="flex items-center gap-1"><Heart className="h-4 w-4 text-primary" /> {t("startup.likes", { count: startup.likes_count })}</span>
                  <span>· {t("startup.supporters", { count: startup.supporters_count })}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="icon" onClick={toggleFavorite}>
                  <Heart className={cn("h-4 w-4", isFavorite && "fill-primary text-primary")} />
                </Button>
                {startup.instagram_url && (
                  <Button variant="outline" size="icon" asChild><a href={startup.instagram_url} target="_blank" rel="noreferrer"><Instagram className="h-4 w-4" /></a></Button>
                )}
                {startup.facebook_url && (
                  <Button variant="outline" size="icon" asChild><a href={startup.facebook_url} target="_blank" rel="noreferrer"><Facebook className="h-4 w-4" /></a></Button>
                )}
                <Button variant="outline" onClick={openChat}>
                  <Lock className="mr-1 h-4 w-4" /> Chat privé
                </Button>
                {startup.whatsapp_number && (
                  <Button className="gradient-warm text-primary-foreground" onClick={() => buy(startup.name)}>
                    <MessageCircle className="mr-1 h-4 w-4" /> {t("startup.buyOnWhatsapp")}
                  </Button>
                )}
              </div>
            </div>

            {/* STATS DÉTAILLÉES */}
            <div className="mt-6 grid grid-cols-2 gap-3 border-t pt-5 sm:grid-cols-4">
              {[
                { icon: Eye, label: "Vues produits", value: stats.views },
                { icon: MessageCircle, label: "Clics WhatsApp", value: stats.clicks },
                { icon: ShoppingBag, label: "Achats confirmés", value: stats.purchases },
                { icon: TrendingUp, label: "Taux de conversion", value: `${conversionRate}%` },
              ].map((s, i) => (
                <div key={i} className="rounded-xl bg-secondary/40 p-3">
                  <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <s.icon className="h-3 w-3" /> {s.label}
                  </div>
                  <div className="font-serif text-xl font-bold">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-12 pb-16 md:grid-cols-3">
        {/* MAIN */}
        <div className="space-y-12 md:col-span-2">
          {/* LIVE PLACEHOLDER */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-muted via-secondary/30 to-muted">
              {startup.is_live ? (
                <div className="text-center">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground animate-pulse">
                    <Radio className="h-3 w-3" /> EN DIRECT
                  </div>
                  <p className="font-serif text-2xl font-bold">{startup.name} est en live !</p>
                  <p className="mt-1 text-sm text-muted-foreground">Vidéo bientôt disponible.</p>
                </div>
              ) : (
                <div className="text-center">
                  <Radio className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                  <p className="font-medium">Aucun live en cours</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Suivez {startup.name} pour être notifié du prochain direct.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* STORY */}
          {startup.creator_story && (
            <section>
              <h2 className="mb-4 font-serif text-2xl font-bold">{t("startup.story")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{startup.creator_story}</p>
            </section>
          )}

          {/* POSTS RÉCENTS */}
          {recentPosts.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-2xl font-bold">Posts récents</h2>
                <span className="text-xs text-muted-foreground">{recentPosts.length} publication{recentPosts.length > 1 ? "s" : ""}</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recentPosts.map((p) => (
                  <div key={p.id} className="w-40 shrink-0 overflow-hidden rounded-xl bg-card shadow-card">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center gradient-soft">
                        <Sparkles className="h-6 w-6 text-primary/40" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-medium">{p.name}</p>
                      {p.price && <p className="text-xs text-primary">{p.price} {p.currency}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PRODUCTS */}
          <section>
            <h2 className="mb-6 font-serif text-2xl font-bold">{t("startup.products")}</h2>
            {products.length === 0 ? (
              <p className="text-muted-foreground">{t("startup.noProducts")}</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {products.map((p) => (
                  <div key={p.id} className="overflow-hidden rounded-xl bg-card shadow-card hover-lift">
                    <Link to={`/product/${p.id}`} className="block">
                      {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover" />}
                    </Link>
                    <div className="space-y-2 p-4">
                      <Link to={`/product/${p.id}`}>
                        <h3 className="font-semibold hover:text-primary">{p.name}</h3>
                      </Link>
                      {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        {p.category && (
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">
                            {p.category}
                          </Badge>
                        )}
                        {p.delegation && (
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="mr-1 h-3 w-3" /> {p.delegation}
                          </Badge>
                        )}
                      </div>
                      {p.delivery_available ? (
                        <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                          <Truck className="mr-1 h-3 w-3" />
                          {p.delivery_fee && p.delivery_fee > 0
                            ? `Livraison ${p.delivery_fee} ${p.currency}`
                            : "Livraison gratuite"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Retrait uniquement
                        </Badge>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        {p.price && <span className="font-semibold text-primary">{p.price} {p.currency}</span>}
                        <Link to={`/product/${p.id}`}>
                          <Button size="sm" className="gradient-warm text-primary-foreground">
                            Voir le produit
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* REVIEWS */}
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold">
                {t("startup.reviews")}
                {reviews.length > 0 && <span className="ml-3 text-sm font-normal text-muted-foreground">★ {avgRating.toFixed(1)} ({reviews.length})</span>}
              </h2>
              {user && <Link to={`/startup/${slug}/review`}><Button size="sm" variant="outline">{t("startup.writeReview")}</Button></Link>}
            </div>
            {reviews.length === 0 ? (
              <p className="text-muted-foreground">{t("startup.noReviews")}</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-xl bg-card p-4 shadow-card">
                    <div className="mb-2 flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={cn("h-4 w-4", i < r.rating ? "fill-warning text-warning" : "text-muted")} />
                      ))}
                    </div>
                    {r.comment && <p className="text-sm text-foreground/80">{r.comment}</p>}
                    {r.photo_url && <img src={r.photo_url} alt="review" className="mt-3 max-h-64 rounded-lg" />}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-4">
          {!user && (
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-5">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <LogIn className="h-4 w-4" />
                <h3 className="font-semibold">Voir tous les détails</h3>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Connectez-vous pour acheter, discuter en privé et accéder à toutes les informations du créateur.
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/login">
                  <Button className="w-full gradient-warm text-primary-foreground">Se connecter</Button>
                </Link>
                <Link to="/signup">
                  <Button variant="outline" className="w-full">Créer un compte</Button>
                </Link>
              </div>
            </div>
          )}
          {isDemo && (
            <div className="rounded-xl bg-warning/10 p-4 text-xs text-muted-foreground">
              ✨ Aperçu de démonstration. Les produits affichés sont des exemples.
            </div>
          )}
          {startup.description && (
            <div className="rounded-xl bg-secondary/40 p-5">
              <h3 className="mb-2 font-semibold">{t("apply.description")}</h3>
              <p className="text-sm text-muted-foreground">{startup.description}</p>
            </div>
          )}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Lock className="h-4 w-4" />
              <h3 className="font-semibold">Chat privé</h3>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Discutez directement avec {startup.name} sans passer par WhatsApp.
            </p>
            <Button onClick={openChat} className="w-full gradient-warm text-primary-foreground">
              Démarrer une conversation
            </Button>
          </div>
        </aside>
      </div>

      {/* CHAT DIALOG */}
      <PrivateChatDialog
        open={chatOpen}
        onOpenChange={setChatOpen}
        startupId={startup.id}
        startupName={startup.name}
      />
    </PageLayout>
  );
}