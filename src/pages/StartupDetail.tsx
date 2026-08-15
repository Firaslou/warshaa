import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MapPin, BadgeCheck, BadgePlus, Award, Heart, MessageCircle, Star,
  Instagram, Facebook, Eye, ShoppingBag, TrendingUp, Radio, Lock, Truck, LogIn, HandHeart, Flag,
  Send, Camera, PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@/components/layout/PageLayout";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { ComplaintDialog } from "@/components/ComplaintDialog";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { ExternalLiveEmbed, detectExternalPlatform } from "@/components/live/ExternalLiveEmbed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEMO_STARTUPS, getDemoProductsForStartup } from "@/lib/demo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Startup {
  id: string;
  owner_id?: string | null;
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
  const [similarCreators, setSimilarCreators] = useState<Startup[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [isSupporter, setIsSupporter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [stats, setStats] = useState({ views: 0, purchases: 0, clicks: 0, likes: 0, supporters: 0 });
  const [isDemo, setIsDemo] = useState(false);
  const [liveRoomOpen, setLiveRoomOpen] = useState(false);
  const [activeLiveEvent, setActiveLiveEvent] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewPhoto, setReviewPhoto] = useState<File | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewAuthors, setReviewAuthors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setSimilarCreators([]);
      // 1. On cherche la boutique dans la vraie base de données
      const { data: s } = await supabase.from("startups").select("*").eq("slug", slug).maybeSingle();
      const demo = DEMO_STARTUPS.find((d) => d.slug === slug);
      
      // Si la boutique existe dans la vraie base de données
      if (s) {
        setStartup(s as Startup);
        setIsDemo(false);

        // 2. On récupère les VRAIS produits de la DB en utilisant startup_id OU startup_slug !
        let productResult = await supabase.from("products").select("*").or(`startup_id.eq.${s.id},startup_slug.eq.${slug}`).eq("is_published" as never, true).order("created_at", { ascending: false });
        if (productResult.error && /is_published/i.test(productResult.error.message)) {
          productResult = await supabase.from("products").select("*").or(`startup_id.eq.${s.id},startup_slug.eq.${slug}`).order("created_at", { ascending: false });
        }
        const { data: revs } = await supabase.from("reviews").select("*").eq("startup_id", s.id).order("created_at", { ascending: false });
        const prods = productResult.data;
        
        setProducts((prods as Product[]) ?? []);
        setReviews((revs as Review[]) ?? []);

        // Similar Creators (same category, excluding current)
        if (s.category) {
          const { data: similar } = await supabase
            .from("startups")
            .select("*")
            .eq("status", "approved")
            .eq("category", s.category)
            .neq("id", s.id)
            .limit(4);
          if (similar) setSimilarCreators(similar as Startup[]);
        }
        
        const rIds = Array.from(new Set(((revs as Review[]) ?? []).map((r) => r.user_id)));
        if (rIds.length) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", rIds);
          const map: Record<string, string> = {};
          (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name; });
          setReviewAuthors(map);
        }
        
        // Vrais chiffres agrégés via fonction serveur (lisible par tous les visiteurs)
        const { data: agg } = await supabase.rpc("get_startup_stats", { _startup_id: s.id });
        const a = (agg ?? {}) as Record<string, number>;
        setStats({
          views: Number(a.views ?? 0),
          purchases: Number(a.purchases ?? 0),
          clicks: Number(a.clicks ?? 0),
          likes: Number(a.likes ?? 0),
          supporters: Number(a.supporters ?? 0),
        });
        
        if (s.is_live) {
          const { data: liveEv } = await supabase
            .from("live_events")
            .select("*")
            .eq("startup_id", s.id)
            .eq("status", "live")
            .maybeSingle();
          setActiveLiveEvent(liveEv);
        } else {
          setActiveLiveEvent(null);
        }

        if (user) {
          const { data: sup } = await supabase.from("startup_supporters").select("id").eq("user_id", user.id).eq("startup_id", s.id).maybeSingle();
          setIsSupporter(!!sup);
        }
      } else if (demo) {
        // Mode démonstration au cas où
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
      setLoading(false);
    })();
  }, [slug, user]);

  const { isStartupFavorite, toggleStartupFavorite } = useFavorites();
  const isFavorite = startup ? isStartupFavorite(startup.id) : false;

  const toggleFavorite = async () => {
    if (!startup) return;
    await toggleStartupFavorite(startup.id);
  };

  const toggleSupport = async () => {
    if (isDemo) { toast.info("Aperçu de démonstration — le soutien sera actif sur les vrais créateurs."); return; }
    if (!user) { toast.info(t("apply.needAccount")); return; }
    if (!startup) return;
    if (isSupporter) {
      await supabase.from("startup_supporters").delete().eq("user_id", user.id).eq("startup_id", startup.id);
      setIsSupporter(false);
      setStartup({ ...startup, supporters_count: Math.max(0, startup.supporters_count - 1) });
      toast.success("Soutien retiré");
    } else {
      const { error } = await supabase.from("startup_supporters").insert({ user_id: user.id, startup_id: startup.id });
      if (error) { toast.error("Impossible de soutenir ce créateur"); return; }
      setIsSupporter(true);
      setStartup({ ...startup, supporters_count: startup.supporters_count + 1 });
      toast.success("Merci pour votre soutien !");
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

  const submitReview = async () => {
    if (!user || !startup) { toast.info("Connectez-vous pour laisser un avis."); return; }
    if (isDemo) { toast.info("Aperçu de démonstration — l'avis ne sera pas enregistré."); return; }
    if (reviewRating < 1) { toast.error("Choisissez une note."); return; }
    setSubmittingReview(true);
    try {
      let photo_url: string | null = null;
      if (reviewPhoto) {
        const ext = reviewPhoto.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${startup.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("review-photos").upload(path, reviewPhoto, { upsert: false });
        if (upErr) throw upErr;
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
      if (error) throw error;
      setReviews((rs) => [data as Review, ...rs]);
      setReviewAuthors((m) => ({ ...m, [user.id]: "Vous" }));
      setReviewRating(0); setReviewText(""); setReviewPhoto(null);
      toast.success("Merci pour votre avis !");
    } catch (e: any) {
      toast.error(e.message ?? "Impossible de publier l'avis.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const myReview = reviews.find((r) => r.user_id === user?.id);

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [reviews]);

  if (loading) {
    return (
      <PageLayout>
        <div className="container py-20 text-center">
          <div className="mx-auto mb-4 h-32 w-full max-w-3xl animate-pulse rounded-2xl bg-muted" />
          <div className="mx-auto h-8 w-64 animate-pulse rounded bg-muted" />
        </div>
      </PageLayout>
    );
  }
  if (!startup) return <PageLayout><div className="container py-20 text-center">{t("notFound.title")}</div></PageLayout>;

  const badgeMeta = {
    new: { label: t("startup.new"), icon: BadgePlus, className: "bg-warning/15 text-warning-foreground border-warning/30" },
    verified: { label: t("startup.verified"), icon: BadgeCheck, className: "bg-success/15 text-success border-success/30" },
    certified: { label: t("startup.certified"), icon: Award, className: "bg-primary/15 text-primary border-primary/30" },
  }[startup.badge];
  const Icon = badgeMeta.icon;

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const conversionRate = stats.clicks > 0 ? Math.round((stats.purchases / stats.clicks) * 100) : 0;
  const recentPosts = products.slice(0, 6);

  return (
    <PageLayout>
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
                  <span className="flex items-center gap-1"><Heart className="h-4 w-4 text-primary" /> {t("startup.likes", { count: stats.likes })}</span>
                  <span>· {t("startup.supporters", { count: startup.supporters_count })}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={isFavorite ? "secondary" : "outline"}
                  size="icon"
                  onClick={toggleFavorite}
                  title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                >
                  <Heart className={cn("h-4 w-4", isFavorite && "fill-rose-500 text-rose-500")} />
                </Button>
                <Button
                  variant={isSupporter ? "default" : "outline"}
                  onClick={toggleSupport}
                  className={cn(isSupporter && "gradient-warm text-primary-foreground")}
                >
                  <HandHeart className={cn("mr-1 h-4 w-4", isSupporter && "fill-current")} />
                  {isSupporter ? "Soutenu" : "Soutenir"}
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
                <Button
                  variant="outline"
                  onClick={() => {
                    if (isDemo) { toast.info("Les réclamations sont désactivées sur les profils de démonstration."); return; }
                    if (!user) { toast.error("Connecte-toi pour envoyer une réclamation"); return; }
                    setComplaintOpen(true);
                  }}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Flag className="mr-1 h-4 w-4" /> Réclamer
                </Button>
                {startup.whatsapp_number && (
                  <Button className="gradient-warm text-primary-foreground" onClick={() => buy(startup.name)}>
                    <MessageCircle className="mr-1 h-4 w-4" /> {t("startup.buyOnWhatsapp")}
                  </Button>
                )}
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
        <div className="space-y-12 md:col-span-2">
          <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
            <div className={cn(
              "relative flex aspect-video items-center justify-center p-6 text-center transition",
              startup.is_live
                ? "bg-gradient-to-br from-destructive/10 via-background to-primary/10 border-2 border-destructive/40"
                : "bg-gradient-to-br from-muted via-secondary/30 to-muted"
            )}>
              {startup.is_live ? (
                <div className="space-y-3 max-w-md animate-fade-in">
                  <div className="inline-flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground animate-pulse shadow-md">
                    <Radio className="h-3.5 w-3.5" /> EN DIRECT MAINTENANT
                  </div>
                  <h3 className="font-serif text-2xl font-bold md:text-3xl">{startup.name} est en direct !</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Regardez la diffusion sur le réseau social du créateur. YouTube et Facebook peuvent s’afficher ici ; Instagram et TikTok s’ouvrent sur leur plateforme.
                  </p>
                  <Button
                    onClick={() => setLiveRoomOpen(true)}
                    className="gradient-warm text-primary-foreground font-semibold rounded-2xl px-6 h-10 shadow-sm"
                  >
                    Regarder le Live
                  </Button>
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

          {startup.creator_story && (
            <section>
              <h2 className="mb-4 font-serif text-2xl font-bold">{t("startup.story")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{startup.creator_story}</p>
            </section>
          )}

          {recentPosts.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-2xl font-bold">Posts récents</h2>
                <span className="text-xs text-muted-foreground">{recentPosts.length} publication{recentPosts.length > 1 ? "s" : ""}</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recentPosts.map((p) => {
                  const hasDiscount = p.discount_percentage && p.discount_percentage > 0;
                  const finalPrice = hasDiscount && p.price 
                    ? p.price - (p.price * (p.discount_percentage / 100)) 
                    : p.price;

                  return (
                    <div key={p.id} className="relative w-40 shrink-0 overflow-hidden rounded-xl bg-card shadow-card">
                      {hasDiscount && (
                        <div className="absolute left-0 top-0 z-10 rounded-br-lg bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
                          -{p.discount_percentage}%
                        </div>
                      )}
                      
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center gradient-soft">
                          <PackageOpen className="h-6 w-6 text-primary/40" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="truncate text-xs font-medium">{p.name}</p>
                        {p.price && (
                          <div className="flex items-baseline gap-1">
                            <p className="text-xs font-bold text-primary">
                              {finalPrice?.toFixed(3)} {p.currency}
                            </p>
                            {hasDiscount && (
                              <p className="text-[10px] text-muted-foreground line-through">
                                {p.price.toFixed(3)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-6 font-serif text-2xl font-bold">{t("startup.products")}</h2>
            {products.length === 0 ? (
              <p className="text-muted-foreground">{t("startup.noProducts")}</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {products.map((p) => {
                  const hasDiscount = p.discount_percentage && p.discount_percentage > 0;
                  const finalPrice = hasDiscount && p.price 
                    ? p.price - (p.price * (p.discount_percentage / 100)) 
                    : p.price;

                  return (
                    <div key={p.id} className="relative overflow-hidden rounded-xl bg-card shadow-card hover-lift">
                      {hasDiscount && (
                        <div className="absolute left-0 top-0 z-10 rounded-br-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">
                          -{p.discount_percentage}%
                        </div>
                      )}

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
                          {p.price && (
                            <div className="flex flex-col">
                              <span className="font-semibold text-primary">
                                {finalPrice?.toFixed(3)} {p.currency}
                              </span>
                              {hasDiscount && (
                                <span className="text-xs text-muted-foreground line-through">
                                  {p.price.toFixed(3)} {p.currency}
                                </span>
                              )}
                            </div>
                          )}
                          <Link to={`/product/${p.id}`}>
                            <Button size="sm" className="gradient-warm text-primary-foreground">
                              Voir le produit
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section id="reviews" className="scroll-mt-24">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold">
                {t("startup.reviews")}
                {reviews.length > 0 && <span className="ml-3 text-sm font-normal text-muted-foreground">★ {avgRating.toFixed(1)} ({reviews.length})</span>}
              </h2>
            </div>

            {user && !myReview && !isDemo && (
              <div className="mb-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium">{t("startup.writeReview")}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setReviewRating(n)} aria-label={`${n} étoile${n > 1 ? "s" : ""}`}>
                      <Star className={cn("h-7 w-7 transition", n <= reviewRating ? "fill-warning text-warning" : "text-muted-foreground/40 hover:text-warning")} />
                    </button>
                  ))}
                </div>
                <Textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Partagez votre expérience avec ce créateur…"
                  rows={3}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                    <Camera className="h-4 w-4" />
                    {reviewPhoto ? reviewPhoto.name : "Ajouter une photo (optionnel)"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setReviewPhoto(e.target.files?.[0] ?? null)} />
                  </label>
                  <Button onClick={submitReview} disabled={submittingReview || reviewRating < 1} className="gradient-warm text-primary-foreground">
                    <Send className="mr-2 h-4 w-4" /> Publier
                  </Button>
                </div>
              </div>
            )}

            {reviews.length === 0 ? (
              <p className="text-muted-foreground">{t("startup.noReviews")}</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div id={`review-${r.id}`} key={r.id} className="scroll-mt-24 rounded-xl bg-card p-4 shadow-card target:ring-2 target:ring-primary/50">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{reviewAuthors[r.user_id] ?? "Utilisateur"}</span>
                        <span className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-3.5 w-3.5", i < r.rating ? "fill-warning text-warning" : "text-muted")} />
                          ))}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    {r.comment && <p className="text-sm text-foreground/80">{r.comment}</p>}
                    {r.photo_url && <img src={r.photo_url} alt="review" className="mt-3 max-h-64 rounded-lg" />}
                  </div>
                ))}
              </div>
            )}
          </section>

          {similarCreators.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-6 font-serif text-2xl font-bold">Créateurs similaires</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {similarCreators.map((creator) => (
                  <Link key={creator.id} to={`/startup/${creator.slug}`} className="flex items-center gap-4 rounded-xl bg-card p-4 shadow-sm hover:shadow-md transition">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                      {creator.logo_url && <img src={creator.logo_url} alt={creator.name} className="h-full w-full object-cover" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground hover:text-primary">{creator.name}</h3>
                      {creator.city && <p className="text-xs text-muted-foreground">{creator.city}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

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

      <PrivateChatDialog
        open={chatOpen}
        onOpenChange={setChatOpen}
        startupId={startup.id}
        startupName={startup.name}
      />

      <ComplaintDialog
        open={complaintOpen}
        onOpenChange={setComplaintOpen}
        startupId={startup.id}
        startupName={startup.name}
      />

      <Dialog open={liveRoomOpen} onOpenChange={setLiveRoomOpen}>
        <DialogContent className="max-w-5xl p-3 sm:p-5">
          <DialogHeader><DialogTitle>{activeLiveEvent?.title || `Live de ${startup.name}`}</DialogTitle></DialogHeader>
          {activeLiveEvent?.external_url || activeLiveEvent?.stream_url ? (
            <ExternalLiveEmbed
              url={activeLiveEvent.external_url || activeLiveEvent.stream_url}
              platform={activeLiveEvent.external_platform ?? detectExternalPlatform(activeLiveEvent.external_url || activeLiveEvent.stream_url)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-semibold">Le lien externe de ce Live n’est pas encore disponible.</p>
              <p className="mt-2 text-sm text-muted-foreground">Le créateur doit ajouter son lien YouTube, Facebook, Instagram ou TikTok.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
