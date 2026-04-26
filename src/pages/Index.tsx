import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, Heart, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCard, StartupCardData } from "@/components/StartupCard";
import { DEMO_STARTUPS, CATEGORIES } from "@/lib/demo";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [startups, setStartups] = useState<StartupCardData[]>(DEMO_STARTUPS);
  const [supportersCount, setSupportersCount] = useState(842);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("startups")
        .select("id, slug, name, tagline, city, category, cover_url, badge, likes_count, supporters_count")
        .eq("status", "approved")
        .order("supporters_count", { ascending: false })
        .limit(8);
      if (data && data.length > 0) {
        setStartups(data as StartupCardData[]);
      }
      const { count } = await supabase
        .from("purchase_clicks")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString());
      if (count !== null) setSupportersCount(842 + count);
    })();
  }, []);

  return (
    <PageLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-soft opacity-60" />
        <div className="container relative py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              {t("common.tagline")}
            </div>
            <h1 className="text-balance font-serif text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
              {t("home.heroSubtitle")}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="gradient-warm text-primary-foreground shadow-elegant" onClick={() => navigate("/creators")}>
                {t("home.heroCta")} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/discover")}>
                <Sparkles className="mr-1 h-4 w-4" /> {t("home.heroCtaSecondary")}
              </Button>
            </div>
          </div>

          {/* supporters banner */}
          <div className="mx-auto mt-16 max-w-md rounded-full border border-primary/20 bg-primary/5 px-6 py-3 text-center text-sm font-medium text-primary backdrop-blur animate-slide-up">
            <Heart className="mr-2 inline h-4 w-4" />
            {t("home.supportersBanner", { count: supportersCount })}
          </div>
        </div>
      </section>

      {/* FEATURED CREATORS */}
      <section className="container py-16 md:py-24">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-bold md:text-4xl">{t("home.featuredTitle")}</h2>
            <p className="mt-2 text-muted-foreground">{t("home.featuredSubtitle")}</p>
          </div>
          <Link to="/creators" className="hidden text-sm font-medium text-primary hover:underline md:block">
            {t("common.viewAll")} <ArrowRight className="ml-1 inline h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {startups.slice(0, 8).map((s, i) => <StartupCard key={s.id} startup={s} index={i} />)}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container py-16">
        <h2 className="mb-8 text-center font-serif text-3xl font-bold md:text-4xl">{t("home.categoriesTitle")}</h2>
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              to={`/creators?category=${encodeURIComponent(cat)}`}
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-smooth hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-secondary/40 py-20">
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

      {/* CTA - BECOME CREATOR */}
      <section className="container py-20">
        <div className="overflow-hidden rounded-3xl gradient-warm p-10 text-center text-primary-foreground shadow-elegant md:p-16">
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
