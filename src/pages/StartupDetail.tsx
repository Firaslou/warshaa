import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MapPin, BadgeCheck, Sparkles, Award, Heart, MessageCircle, Star,
  Instagram, Facebook, Eye, ShoppingBag, TrendingUp, Radio, Lock, Truck, LogIn, HandHeart, Flag,
  Send, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@/components/layout/PageLayout";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { ComplaintDialog } from "@/components/ComplaintDialog";
import { StoriesBar } from "@/components/stories/StoriesBar";
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
  discount_percentage?: number | null;
  startup_slug?: string | null;
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
  const [isSupporter, setIsSupporter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [stats, setStats] = useState({ views: 0, purchases: 0, clicks: 0 });
  const [isDemo, setIsDemo] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewPhoto, setReviewPhoto] = useState<File | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewAuthors, setReviewAuthors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        // 1. On récupère la boutique depuis la DB
        const { data: s } = await supabase.from("startups").select("*").eq("slug", slug).maybeSingle();
        const demo = DEMO_STARTUPS.find((d) => d.slug === slug);
        
        if (s) {
          setStartup(s as Startup);
          setIsDemo(false);

          // 2. On charge les produits via la colonne startup_slug et les avis
          const [{ data: prods }, { data: revs }] = await Promise.all([
            supabase.from("products").select("*").eq("startup_slug", slug).order("created_at", { ascending: false }),
            supabase.from("reviews").select("*").eq("startup_id", s.id).order("created_at", { ascending: false }),
          ]);
          
          setProducts((prods as Product[]) ?? []);
          setReviews((revs as Review[]) ?? []);
          
          // Profils des auteurs des avis
          const rIds = Array.from(new Set(((revs as Review[]) ?? []).map((r) => r.user_id)));
          if (rIds.length) {
            const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", rIds);
            const map: Record<string, string> = {};
            (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name; });
            setReviewAuthors(map);
          }
          
          // Statistiques de la boutique
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
            const { data: fav } = await supabase.from("favorites").select("id").eq("user_id", user.id).eq("startup_id", s.id).maybeSingle();
            setIsFavorite(!!fav);
            const { data: sup } = await supabase.from("startup_supporters").select("id").eq("user_id", user.id).eq("startup_id", s.id).maybeSingle();
            setIsSupporter(!!sup);
          }
        } else if (demo) {
          // Secours Démo si pas dans la DB
          setIsDemo(true);
          setStartup({
            ...demo,
            description: "Une marque pleine de passion et d'authenticité.",
            creator_story: "Cette marque est née d'une envie de partager un savoir-faire transmis de génération en génération.",
            whatsapp_number: "+21620000000",
          } as Startup);
          setProducts(getDemoProductsForStartup(demo.slug) as any);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, user]);

  const toggleFavorite = async () => {
    if (!user || !startup) return;
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("startup_id", startup.id);
      setIsFavorite(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, startup_id: startup.id });
      setIsFavorite(true);
    }
  };

  const toggleSupport = async () => {
    if (!user || !startup) return;
    if (isSupporter) {
      await supabase.from("startup_supporters").delete().eq("user_id", user.id).eq("startup_id", startup.id);
      setIsSupporter(false);
      setStartup({ ...startup, supporters_count: Math.max(0, startup.supporters_count - 1) });
    } else {
      await supabase.from("startup_supporters").insert({ user_id: user.id, startup_id: startup.id });
      setIsSupporter(true);
      setStartup({ ...startup, supporters_count: startup.supporters_count + 1 });
    }
  };

  const buy = (productName: string, productId?: string) => {
    if (!startup?.whatsapp_number) return;
    openWhatsApp({
      phone: startup.whatsapp_number,
      productName,
      startupId: startup.id,
      productId,
      message: t("startup.whatsappMessage", { product: productName }),
    });
  };

  const openChat = () => { if (user) setChatOpen(true); };

  const submitReview = async () => {
    if (!user || !startup || reviewRating < 1) return;
    setSubmittingReview(true);
    try {
      let photo_url: string | null = null;
      if (reviewPhoto) {
        const ext = reviewPhoto.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${startup.id}-${Date.now()}.${ext}`;
        await supabase.storage.from("review-photos").upload(path, reviewPhoto);
        const { data: pub } = supabase.storage.from("review-photos").getPublicUrl(path);
        photo_url = pub.publicUrl;
      }
      const { data, error } = await supabase.from("reviews").insert({
        user_id: user.id,
        startup_id: startup.id,
        rating: reviewRating,
        comment: reviewText.trim() || null,
        photo_url,
      }).select("*").single();
      if (!error && data) {
        setReviews((rs) => [data as Review, ...rs]);
        setReviewText(""); setReviewRating(0); setReviewPhoto(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <PageLayout><div className="container py-20 text-center">{t("common.loading")}</div></PageLayout>;
  if (!startup) return <PageLayout><div className="container py-20 text-center">{t("notFound.title")}</div></PageLayout>;

  const badgeMeta = {
    new: { label: t("startup.new"), icon: Sparkles, className: "bg-warning/15 text-warning-foreground border-warning/30" },
    verified: { label: t("startup.verified"), icon: BadgeCheck, className: "bg-success/15 text-success border-success/30" },
    certified: { label: t("startup.certified"), icon: Award, className: "bg-primary/15 text-primary border-primary/30" },
  }[startup.badge || "new"];
  const Icon = badgeMeta.icon;

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const conversionRate = stats.clicks > 0 ? Math.round((stats.purchases / stats.clicks) * 100) : 0;
  const recentPosts = products.slice(0, 6);

  return (
    <PageLayout>
      <section className="relative">
        <div className="aspect-[21/9] w-full overflow-hidden bg-muted md:aspect-[3/1]">
          {startup.cover_url && <img src={startup.cover_url} alt={startup.name} className="h-full w-full object-cover" />}
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
                <Button variant={isSupporter ? "default" : "outline"} onClick={toggleSupport}>
                  <HandHeart className={cn("mr-1 h-4 w-4", isSupporter && "fill-current")} />
                  {isSupporter ? "Soutenu" : "Soutenir"}
                </Button>
                {startup.whatsapp_number && (
                  <Button className="gradient-warm text-primary-foreground" onClick={() => buy(startup.name)}>
                    <MessageCircle className="mr-1 h-4 w-4" /> {t("startup.buyOnWhatsapp")}
                  </Button>
                )}
                <Button variant="outline" onClick={openChat}><Lock className="mr-1 h-4 w-4" /> Chat privé</Button>
              </div>
            </div>

            <div className="mt-6 border-t pt-3">
              <StoriesBar startupId={startup.id} startupSlug={startup.slug} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 border-t pt-5 sm:grid-cols-4">
              {[
                { icon: Eye, label: "Vues produits", value: stats.views },
                { icon: MessageCircle, label: "Clics WhatsApp", value: stats.clicks },
                { icon: ShoppingBag, label: "Achats confirmés", value: stats.purchases },
                { icon: TrendingUp, label: "Taux de conversion", value: `${conversionRate}%` },
              ].map((s, i) => (
                <div key={i} className="rounded-xl bg-secondary/40 p-3">
                  <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><s.icon className="h-3 w-3" /> {s.label}</div>
                  <div className="font-serif text-xl font-bold">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-12 pb-16 md:grid-cols-3">
        <div className="space-y-12 md:col-span-2">
          {startup.creator_story && (
            <section>
              <h2 className="mb-4 font-serif text-2xl font-bold">{t("startup.story")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{startup.creator_story}</p>
            </section>
          )}

          {/*  Recent Posts Section */}
          {recentPosts.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-bold mb-4">Posts récents</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recentPosts.map((p) => {
                  const hasDiscount = p.discount_percentage && p.discount_percentage > 0;
                  const finalPrice = hasDiscount && p.price ? p.price - (p.price * (p.discount_percentage / 100)) : p.price;

                  return (
                    <div key={p.id} className="relative w-40 shrink-0 overflow-hidden rounded-xl bg-card shadow-card">
                      {hasDiscount && (
                        <div className="absolute left-0 top-0 z-10 bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white rounded-br-lg">
                          -{p.discount_percentage}%
                        </div>
                      )}
                      {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-muted" />}
                      <div className="p-2">
                        <p className="truncate text-xs font-medium">{p.name}</p>
                        {p.price && (
                          <div className="flex items-baseline gap-1">
                            <p className="text-xs font-bold text-primary">{finalPrice?.toFixed(3)} {p.currency}</p>
                            {hasDiscount && <p className="text-[10px] text-muted-foreground line-through">{p.price.toFixed(3)}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Main Products Grid Section */}
          <section>
            <h2 className="mb-6 font-serif text-2xl font-bold">{t("startup.products")}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {products.map((p) => {
                // 🔍 CALCUL ET AFFICHAGE DES REDUCTIONS (Comme sur la page produit)
                const hasDiscount = p.discount_percentage && p.discount_percentage > 0;
                const finalPrice = hasDiscount && p.price ? p.price - (p.price * (p.discount_percentage / 100)) : p.price;

                return (
                  <div key={p.id} className="relative overflow-hidden rounded-xl bg-card shadow-card hover-lift border border-border/40">
                    {/* Badge rouge de réduction */}
                    {hasDiscount && (
                      <div className="absolute left-0 top-0 z-10 bg-red-600 px-3 py-1 text-sm font-bold text-white rounded-br-lg shadow-sm">
                        -{p.discount_percentage}%
                      </div>
                    )}

                    <Link to={`/product/${p.id}`} className="block">
                      {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover" />}
                    </Link>
                    <div className="space-y-2 p-4">
                      <Link to={`/product/${p.id}`}><h3 className="font-semibold hover:text-primary">{p.name}</h3></Link>
                      {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                      
                      <div className="flex flex-wrap gap-1.5">
                        {p.category && <Badge variant="outline" className="text-xs">{p.category}</Badge>}
                        {p.delegation && <Badge variant="outline" className="text-xs"><MapPin className="mr-1 h-3 w-3" /> {p.delegation}</Badge>}
                      </div>
                      
                      {p.delivery_available ? (
                        <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                          <Truck className="mr-1 h-3 w-3" /> {p.delivery_fee && p.delivery_fee > 0 ? `Livraison ${p.delivery_fee} ${p.currency}` : "Livraison gratuite"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Retrait uniquement</Badge>
                      )}
                      
                      <div className="flex items-center justify-between pt-2">
                        {p.price && (
                          <div className="flex flex-col">
                            {/* Affichage du prix soldé */}
                            <span className="font-semibold text-primary text-lg">
                              {finalPrice?.toFixed(3)} {p.currency}
                            </span>
                            {/* Affichage de l'ancien prix barré */}
                            {hasDiscount && (
                              <span className="text-xs text-muted-foreground line-through">
                                {p.price.toFixed(3)} {p.currency}
                              </span>
                            )}
                          </div>
                        )}
                        <Link to={`/product/${p.id}`}><Button size="sm" className="gradient-warm text-primary-foreground">Voir le produit</Button></Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Reviews Section */}
          <section>
            <h2 className="mb-6 font-serif text-2xl font-bold">
              {t("startup.reviews")}
              {reviews.length > 0 && <span className="ml-3 text-sm font-normal text-muted-foreground">★ {avgRating.toFixed(1)} ({reviews.length})</span>}
            </h2>

            {user && !reviews.some(r => r.user_id === user.id) && (
              <div className="mb-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium">{t("startup.writeReview")}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setReviewRating(n)}>
                      <Star className={cn("h-7 w-7", n <= reviewRating ? "fill-warning text-warning" : "text-muted-foreground/40")} />
                    </button>
                  ))}
                </div>
                <Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Votre avis…" rows={3} />
                <Button onClick={submitReview} disabled={submittingReview || reviewRating < 1} className="gradient-warm text-primary-foreground">Publier</Button>
              </div>
            )}

            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl bg-card p-4 shadow-card border">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{reviewAuthors[r.user_id] ?? "Utilisateur"}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="text-sm">{r.comment}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {startup.description && (
            <div className="rounded-xl bg-secondary/40 p-5">
              <h3 className="mb-2 font-semibold">{t("apply.description")}</h3>
              <p className="text-sm text-muted-foreground">{startup.description}</p>
            </div>
          )}
        </aside>
      </div>

      <PrivateChatDialog open={chatOpen} onOpenChange={setChatOpen} startupId={startup.id} startupName={startup.name} />
      <ComplaintDialog open={complaintOpen} onOpenChange={setComplaintOpen} startupId={startup.id} startupName={startup.name} />
    </PageLayout>
  );
}
