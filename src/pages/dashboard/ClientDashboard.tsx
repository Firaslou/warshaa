import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/components/layout/PageLayout";
import { StartupCard, StartupCardData } from "@/components/StartupCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function ClientDashboard() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [favs, setFavs] = useState<StartupCardData[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("favorites")
        .select("startups(id, slug, name, tagline, city, category, cover_url, badge, likes_count, supporters_count)")
        .eq("user_id", user.id);
      setFavs((data?.map((f: any) => f.startups).filter(Boolean) as StartupCardData[]) ?? []);
    })();
  }, [user]);

  if (loading) return <PageLayout><div className="container py-20 text-center">{t("common.loading")}</div></PageLayout>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <PageLayout>
      <div className="container py-12">
        <h1 className="font-serif text-4xl font-bold">{t("dashboard.client.title")}</h1>
        <h2 className="mt-10 mb-4 font-serif text-2xl font-semibold">{t("dashboard.client.favorites")}</h2>
        {favs.length === 0 ? (
          <p className="text-muted-foreground">{t("dashboard.client.noFavorites")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {favs.map((s, i) => <StartupCard key={s.id} startup={s} index={i} />)}
          </div>
        )}
      </div>
    </PageLayout>
  );
}