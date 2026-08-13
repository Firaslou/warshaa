import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Heart, ArrowRight, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCardData } from "@/components/StartupCard";
import { DEMO_STARTUPS } from "@/lib/demo";
import { supabase } from "@/integrations/supabase/client";

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pool, setPool] = useState<StartupCardData[]>(DEMO_STARTUPS);
  const [current, setCurrent] = useState<StartupCardData | null>(DEMO_STARTUPS[0] ?? null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("startups")
        .select("id, slug, name, tagline, city, category, cover_url, badge, likes_count, supporters_count")
        .eq("status", "approved");
      if (data && data.length > 0) {
        setPool(data as StartupCardData[]);
        setCurrent(data[Math.floor(Math.random() * data.length)] as StartupCardData);
      }
    })();
  }, []);

  const next = () => {
    if (pool.length === 0) return;
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && pick.id === current?.id) {
      pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    }
    setCurrent(pick);
    setAnimKey((k) => k + 1);
  };

  return (
    <PageLayout>
      <div className="container py-12">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-4xl font-bold md:text-5xl">
            <Heart className="mr-2 inline h-8 w-8 fill-primary/15 text-primary" />
            {t("discover.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("discover.subtitle")}</p>
        </div>

        {!current ? (
          <p className="py-20 text-center text-muted-foreground">{t("discover.noResults")}</p>
        ) : (
          <div key={animKey} className="mx-auto max-w-2xl animate-fade-in">
            <div className="overflow-hidden rounded-3xl bg-card shadow-elegant">
              <div className="relative aspect-[4/5] bg-muted">
                {current.cover_url && (
                  <img src={current.cover_url} alt={current.name} className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent p-6">
                  <h2 className="font-serif text-3xl font-bold text-foreground">{current.name}</h2>
                  <p className="mt-2 text-foreground/80">{current.tagline}</p>
                  <div className="mt-2 text-sm text-muted-foreground">{current.city} · {current.category}</div>
                </div>
              </div>
              <div className="flex gap-3 p-4">
                <Button className="flex-1 gradient-warm text-primary-foreground" onClick={() => navigate(`/startup/${current.slug}`)}>
                  {t("common.discover")} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button variant="outline" className="flex-1" onClick={next}>
                  <Shuffle className="mr-1 h-4 w-4" /> {t("discover.next")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
