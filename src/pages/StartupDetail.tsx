import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, BadgeCheck, Sparkles, Award, Heart, MessageCircle, Star, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/layout/PageLayout";
import { DEMO_STARTUPS } from "@/lib/demo";
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
  category?: string | null;
  cover_url?: string | null;
  logo_url?: string | null;
  whatsapp_number?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  badge: "new" | "verified" | "certified";
  likes_count: number;
  supporters_count: number;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency: string;
  images: string[];
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

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: s } = await supabase.from("startups").select("*").eq("slug", slug).maybeSingle();
      if (s) {
        setStartup(s as Startup);
        const [{ data: prods }, { data: revs }] = await Promise.all([
          supabase.from("products").select("*").eq("startup_id", s.id).order("created_at", { ascending: false }),
          supabase.from("reviews").select("*").eq("startup_id", s.id).order("created_at", { ascending: false }),
        ]);
        setProducts((prods as Product[]) ?? []);
        setReviews((revs as Review[]) ?? []);
        if (user) {
          const { data: fav } = await supabase
            .from("favorites").select("id").eq("user_id", user.id).eq("startup_id", s.id).maybeSingle();
          setIsFavorite(!!fav);
        }
      } else {
        // Fallback to demo
        const demo = DEMO_STARTUPS.find((d) => d.slug === slug);
        if (demo) {
          setStartup({
            ...demo,
            description: "Une marque pleine de passion et d'authenticité.",
            creator_story: "Cette marque est née d'une envie de partager un savoir-faire transmis de génération en génération. Chaque pièce raconte une histoire.",
            whatsapp_number: "+21620000000",
            logo_url: null,
            instagram_url: null,
            facebook_url: null,
          } as Startup);
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
    if (!startup?.whatsapp_number) return;
    openWhatsApp({
      phone: startup.whatsapp_number,
      productName,
      startupId: startup.id,
      productId,
      message: t("startup.whatsappMessage", { product: productName }),
    });
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
                <Badge variant="outline" className={cn("mb-3 border", badgeMeta.className)}>
                  <Icon className="mr-1 h-3 w-3" /> {badgeMeta.label}
                </Badge>
                <h1 className="font-serif text-4xl font-bold md:text-5xl">{startup.name}</h1>
                {startup.tagline && <p className="mt-2 text-lg text-muted-foreground">{startup.tagline}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {startup.city && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {startup.city}</span>}
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
                {startup.whatsapp_number && (
                  <Button className="gradient-warm text-primary-foreground" onClick={() => buy(startup.name)}>
                    <MessageCircle className="mr-1 h-4 w-4" /> {t("startup.buyOnWhatsapp")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-12 pb-16 md:grid-cols-3">
        {/* MAIN */}
        <div className="space-y-12 md:col-span-2">
          {/* STORY */}
          {startup.creator_story && (
            <section>
              <h2 className="mb-4 font-serif text-2xl font-bold">{t("startup.story")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{startup.creator_story}</p>
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
                    {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover" />}
                    <div className="space-y-2 p-4">
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                      <div className="flex items-center justify-between pt-2">
                        {p.price && <span className="font-semibold text-primary">{p.price} {p.currency}</span>}
                        <Button size="sm" className="gradient-warm text-primary-foreground" onClick={() => buy(p.name, p.id)}>
                          <MessageCircle className="mr-1 h-3 w-3" /> {t("startup.buyOnWhatsapp")}
                        </Button>
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
          {startup.description && (
            <div className="rounded-xl bg-secondary/40 p-5">
              <h3 className="mb-2 font-semibold">{t("apply.description")}</h3>
              <p className="text-sm text-muted-foreground">{startup.description}</p>
            </div>
          )}
        </aside>
      </div>
    </PageLayout>
  );
}