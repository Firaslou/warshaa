import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Heart, MessageCircle, Search, HandHeart, Shuffle, Store, Shapes,
  Users, ShoppingBag, BadgeCheck, MapPin, Quote,
  Gem, Flame, Palette, Shirt, Briefcase, Coffee, Droplet, Cookie,
  Home as HomeIcon, Recycle, User, UserCheck, Baby, Gift, Star, MoreHorizontal,
  ChevronLeft, ChevronRight, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCard, StartupCardData } from "@/components/StartupCard";
import { CATEGORIES_KEYS } from "@/lib/tunisia";
import { supabase } from "@/integrations/supabase/client";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { InstallAppButton } from "@/components/InstallAppButton";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  jewelry: Gem, candles: Flame, art: Palette, fashion: Shirt, leather: Briefcase,
  ceramics: Coffee, cosmetics: Droplet, food: Cookie, home: HomeIcon, thrift: Recycle,
  women: User, men: UserCheck, kids: Baby, gifts: Gift, personalized: Star, other: MoreHorizontal,
};

interface CoupDeCoeurData extends StartupCardData {
  logo_url?: string | null;
  creator_story?: string | null;
}

interface NewThisWeekProduct {
  id: string;
  name: string;
  images: string[];
  price: number | null;
  currency: string;
  category: string | null;
  created_at: string;
  startups: { name: string; slug: string; logo_url: string | null; city: string | null } | null;
}

interface NextLive {
  id: string;
  title: string;
  scheduled_at: string;
  cover_url: string | null;
  startup_name: string;
  startup_slug: string;
}

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [startups, setStartups] = useState<StartupCardData[]>([]);
  const [pool, setPool] = useState<CoupDeCoeurData[]>([]);
  const [newThisWeek, setNewThisWeek] = useState<NewThisWeekProduct[]>([]);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [nextLive, setNextLive] = useState<NextLive | null>(null);
  const [stats, setStats] = useState({
    activeCreators: 0,
    monthSupporters: 0,
    confirmedPurchases: 0,
    verifiedPercent: 0,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("startups")
        .select("id, slug, name, tagline, city, category, logo_url, badge, likes_count, supporters_count")
        .eq("status", "approved")
        .order("supporters_count", { ascending: false })
        .limit(10);
      if (data && data.length > 0) setStartups(data as StartupCardData[]);

      // Pool for daily pick and recent activity: include logo, story and manual post date.
      const { data: poolData } = await supabase
        .from("startups")
        .select("id, slug, name, tagline, city, category, logo_url, creator_story, badge, likes_count, supporters_count, last_post_at")
        .eq("status", "approved");
      if (poolData && poolData.length > 0) setPool(poolData as CoupDeCoeurData[]);

      // Display the actual products published during the last seven days.
      const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      const { data: recentProducts } = await supabase
        .from("products")
        .select("id, name, images, price, currency, category, created_at, startups:startup_id(name, slug, logo_url, city)")
        .eq("is_published", true)
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(24);
      setNewThisWeek((recentProducts ?? []) as unknown as NewThisWeekProduct[]);

      // Prochain live (bannière mobile)
      const { data: liveData } = await supabase
        .from("live_events")
        .select("id, title, scheduled_at, cover_url, startup_id")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(Date.now() - 3600 * 1000).toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1);
      const live = liveData?.[0];
      if (live) {
        const { data: ls } = await supabase
          .from("startups")
          .select("name, slug")
          .eq("id", live.startup_id)
          .maybeSingle();
        if (ls) {
          setNextLive({
            id: live.id,
            title: live.title,
            scheduled_at: live.scheduled_at,
            cover_url: live.cover_url,
            startup_name: ls.name,
            startup_slug: ls.slug,
          });
        }
      }

      // Vrais chiffres agrégés (fonction serveur, accessible à tous les visiteurs)
      const { data: platform } = await supabase.rpc("get_platform_stats");
      const p = (platform ?? {}) as Record<string, number>;
      setStats({
        activeCreators: Number(p.active_creators ?? 0),
        monthSupporters: Number(p.month_supporters ?? 0),
        confirmedPurchases: Number(p.confirmed_purchases ?? 0),
        verifiedPercent: Number(p.verified_percent ?? 0),
      });
    })();
  }, []);

  // Deterministic daily pick: same creator highlighted for the whole day for everyone
  const coupDeCoeur = useMemo<CoupDeCoeurData | null>(() => {
    const list = pool.length > 0 ? pool : (startups as CoupDeCoeurData[]);
    if (list.length === 0) return null;
    const today = new Date();
    const key = `${today.getUTCFullYear()}-${today.getUTCMonth()}-${today.getUTCDate()}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return list[hash % list.length];
  }, [pool, startups]);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
    [],
  );

  const featured = startups.slice(0, 10);

  // Carousel pagination: 4 per slide on desktop
  const PER_SLIDE = 4;
  const slideCount = Math.max(1, Math.ceil(newThisWeek.length / PER_SLIDE));
  const goPrev = () => setCarouselIdx((i) => (i - 1 + slideCount) % slideCount);
  const goNext = () => setCarouselIdx((i) => (i + 1) % slideCount);
  const fmtRelative = (iso?: string | null) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days <= 0) {
      const hours = Math.max(1, Math.floor(diff / 3600000));
      return `${hours}h`;
    }
    return `${days}d`;
  };

  const statCards = [
    { icon: Users, label: t("stats.activeCreators"), value: stats.activeCreators },
    { icon: Heart, label: t("stats.monthSupporters"), value: stats.monthSupporters },
    { icon: ShoppingBag, label: t("stats.confirmedPurchases"), value: stats.confirmedPurchases },
    { icon: BadgeCheck, label: t("stats.verifiedPercent"), value: `${stats.verifiedPercent}%` },
  ];

  return (
    <PageLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-soft opacity-60" />
        <div className="container relative py-12 sm:py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-center text-xs font-medium backdrop-blur sm:mb-6 sm:px-4">
              <HandHeart className="h-3 w-3 text-primary" />
              {t("common.tagline")}
            </div>
            <h1 className="text-balance font-serif text-[2.25rem] font-bold leading-[1.08] tracking-tight min-[390px]:text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg md:text-xl">
              {t("home.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row">
              <Button size="lg" className="w-full max-w-xs gradient-warm text-primary-foreground shadow-elegant sm:w-auto" onClick={() => navigate("/creators")}>
                {t("home.heroCta")} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="w-full max-w-xs sm:w-auto" onClick={() => navigate("/discover")}>
                <Shuffle className="mr-1 h-4 w-4" /> {t("home.heroCtaSecondary")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE STATS — 4 cards */}
      <section className="container -mt-8 md:-mt-12">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {statCards.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-5 shadow-card animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl gradient-warm shadow-elegant">
                <s.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="font-serif text-2xl font-bold md:text-3xl">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground md:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground italic">{t("stats.supportLine")}</p>
      </section>

      {/* STORIES (24h) */}
      <section className="container mt-8">
        <StoriesBar />
      </section>

      {/* COUP DE CŒUR DU JOUR */}
      {coupDeCoeur && (
        <section className="container py-10 md:py-20">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full gradient-warm px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-elegant">
              <Heart className="h-3 w-3 fill-current" /> {t("stats.dailyBadge")}
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold md:text-4xl">{t("stats.dailyTitle")}</h2>
            <p className="mt-2 text-sm capitalize text-muted-foreground">{todayLabel}</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-elegant">
            <div className="grid md:grid-cols-2">
              <Link to={`/startup/${coupDeCoeur.slug}`} className="group relative aspect-[4/3] overflow-hidden bg-muted md:aspect-auto">
                {coupDeCoeur.logo_url ? (
                  <img src={coupDeCoeur.logo_url} alt={coupDeCoeur.name} className="h-full w-full object-contain p-10 transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center gradient-soft">
                    <Store className="h-16 w-16 text-primary/40" />
                  </div>
                )}
                {coupDeCoeur.badge && (coupDeCoeur.badge === "verified" || coupDeCoeur.badge === "certified") && (
                  <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow-card backdrop-blur">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                    {t(`badges.${coupDeCoeur.badge}`, coupDeCoeur.badge)}
                  </div>
                )}
              </Link>
              <div className="flex flex-col justify-center p-5 sm:p-8 md:p-12">
                <div className="mb-4 flex items-center gap-3">
                  {coupDeCoeur.logo_url ? (
                    <img src={coupDeCoeur.logo_url} alt="" className="h-14 w-14 rounded-full border-2 border-primary/30 object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full gradient-warm text-lg font-bold text-primary-foreground">
                      {coupDeCoeur.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-2xl font-bold md:text-3xl">{coupDeCoeur.name}</h3>
                    {coupDeCoeur.city && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {coupDeCoeur.city}
                      </p>
                    )}
                  </div>
                </div>

                {coupDeCoeur.tagline && (
                  <p className="text-base text-foreground/80">{coupDeCoeur.tagline}</p>
                )}

                {coupDeCoeur.creator_story && (
                  <div className="mt-4 rounded-xl border-l-2 border-primary/40 bg-secondary/30 p-4">
                    <Quote className="mb-1 h-4 w-4 text-primary/60" />
                    <p className="line-clamp-4 text-sm italic text-muted-foreground">{coupDeCoeur.creator_story}</p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4 text-primary" /> {coupDeCoeur.likes_count ?? 0}</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> {coupDeCoeur.supporters_count ?? 0}</span>
                  {coupDeCoeur.category && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{coupDeCoeur.category}</span>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => navigate(`/startup/${coupDeCoeur.slug}`)} className="gradient-warm text-primary-foreground">
                    {t("stats.dailyCta")} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/discover")}>
                    <Shuffle className="mr-1 h-4 w-4" /> {t("home.heroCtaSecondary")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* NOUVEAUTÉS CETTE SEMAINE */}
      <section className="container py-10 md:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Clock className="h-3 w-3" /> {t("newThisWeek.newBadge")}
            </div>
            <h2 className="font-serif text-3xl font-bold md:text-4xl">{t("newThisWeek.title")}</h2>
            <p className="mt-2 text-muted-foreground">Les produits publiés durant les 7 derniers jours</p>
          </div>
          {newThisWeek.length > PER_SLIDE && (
            <div className="hidden gap-2 md:flex">
              <Button size="icon" variant="outline" onClick={goPrev} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={goNext} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {newThisWeek.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
            {t("newThisWeek.empty")}
          </p>
        ) : (
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${carouselIdx * 100}%)` }}
            >
              {Array.from({ length: slideCount }).map((_, slideI) => (
                <div key={slideI} className="grid w-full shrink-0 grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-4 md:gap-5">
                  {newThisWeek.slice(slideI * PER_SLIDE, slideI * PER_SLIDE + PER_SLIDE).map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-smooth hover:-translate-y-1 hover:border-primary hover:shadow-elegant"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center gradient-soft">
                            <Store className="h-10 w-10 text-primary/40" />
                          </div>
                        )}
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold shadow-card backdrop-blur">
                          <Clock className="h-3 w-3 text-primary" /> {fmtRelative(product.created_at)}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2">
                          {product.startups?.logo_url ? (
                            <img src={product.startups.logo_url} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-warm text-xs font-bold text-primary-foreground">
                              {product.startups?.name?.charAt(0).toUpperCase() ?? "W"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1"><h3 className="truncate font-serif text-base font-semibold">{product.name}</h3><p className="truncate text-[11px] text-muted-foreground">{product.startups?.name}</p></div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                          {product.category && <span className="truncate text-muted-foreground">{product.category}</span>}
                          {product.price != null && <strong className="whitespace-nowrap text-primary">{Number(product.price).toFixed(3)} {product.currency}</strong>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            {slideCount > 1 && (
              <div className="mt-5 flex items-center justify-center gap-1.5">
                {Array.from({ length: slideCount }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIdx(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === carouselIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* FEATURED CREATORS — 10 */}
      <section className="container py-10 md:py-16">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-bold md:text-4xl">{t("home.featuredTitle")}</h2>
            <p className="mt-2 text-muted-foreground">{t("home.featuredSubtitle")}</p>
          </div>
          <Link to="/creators" className="hidden text-sm font-medium text-primary hover:underline md:block">
            {t("common.viewAll")} <ArrowRight className="ml-1 inline h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-5">
          {featured.map((s, i) => <StartupCard key={s.id} startup={s} index={i} />)}
        </div>
      </section>

      {/* 16 UNIVERS */}
      <section className="container py-10 md:py-16">
        <div className="mb-10 text-center">
          <h2 className="font-serif text-3xl font-bold md:text-4xl">{t("home.categoriesTitle")}</h2>
          <p className="mt-2 text-muted-foreground">16 univers à explorer</p>
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
          {CATEGORIES_KEYS.map((key, i) => {
            const Icon = CATEGORY_ICONS[key] ?? Shapes;
            return (
              <Link
                key={key}
                to={`/creators?category=${encodeURIComponent(t(`categoriesExt.${key}`))}`}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-smooth hover:-translate-y-1 hover:border-primary hover:shadow-elegant animate-slide-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:gradient-warm group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium md:text-sm">{t(`categoriesExt.${key}`)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* INSTALL APP */}
      <InstallAppButton />

      {/* HOW IT WORKS */}
      <section className="bg-secondary/40 py-12 md:py-20">
        <div className="container">
          <h2 className="mb-12 text-center font-serif text-3xl font-bold md:text-4xl">{t("home.stepsTitle")}</h2>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {[
              { icon: Search, title: t("home.step1"), desc: t("home.step1Desc") },
              { icon: MessageCircle, title: t("home.step2"), desc: t("home.step2Desc") },
              { icon: Heart, title: t("home.step3"), desc: t("home.step3Desc") },
            ].map((step, i) => (
              <div key={i} className="text-center animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-warm shadow-elegant">
                  <step.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="mb-2 font-serif text-xl font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-12 md:py-20">
        <div className="overflow-hidden rounded-3xl gradient-warm p-6 text-center text-primary-foreground shadow-elegant sm:p-10 md:p-16">
          <h2 className="font-serif text-3xl font-bold md:text-4xl">{t("home.becomeCreator")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">{t("home.becomeCreatorDesc")}</p>
          <Button size="lg" variant="secondary" className="mt-8" onClick={() => navigate("/apply")}>
            {t("home.applyNow")} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>
    </PageLayout>
  );
};

export default Index;
