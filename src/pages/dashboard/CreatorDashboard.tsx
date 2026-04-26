import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Users, MessageCircle } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function CreatorDashboard() {
  const { t } = useTranslation();
  const { user, loading, isCreator } = useAuth();
  const [startup, setStartup] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [stats, setStats] = useState({ clicks: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: s } = await supabase.from("startups").select("*").eq("owner_id", user.id).maybeSingle();
      setStartup(s);
      if (s) {
        const { count } = await supabase.from("purchase_clicks").select("id", { count: "exact", head: true }).eq("startup_id", s.id);
        setStats({ clicks: count ?? 0 });
      } else {
        const { data: a } = await supabase.from("startup_applications").select("*").eq("applicant_id", user.id).order("created_at", { ascending: false }).maybeSingle();
        setApplication(a);
      }
    })();
  }, [user]);

  if (loading) return <PageLayout><div className="container py-20 text-center">{t("common.loading")}</div></PageLayout>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <PageLayout>
      <div className="container py-12">
        <h1 className="font-serif text-4xl font-bold">{t("dashboard.creator.title")}</h1>
        {!startup ? (
          <div className="mt-8 rounded-2xl bg-card p-8 text-center shadow-card">
            {application ? (
              <>
                <Badge className="mb-3">{application.status}</Badge>
                <p className="text-muted-foreground">{t("dashboard.creator.applicationPending")}</p>
              </>
            ) : (
              <p className="text-muted-foreground">{t("dashboard.creator.noStartup")}</p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard icon={Heart} label={t("dashboard.creator.totalLikes")} value={startup.likes_count} />
              <StatCard icon={Users} label={t("dashboard.creator.totalSupporters")} value={startup.supporters_count} />
              <StatCard icon={MessageCircle} label={t("dashboard.creator.totalClicks")} value={stats.clicks} />
            </div>
            <div className="mt-8 rounded-2xl bg-card p-6 shadow-card">
              <h2 className="font-serif text-2xl font-semibold">{startup.name}</h2>
              <p className="mt-2 text-muted-foreground">{startup.tagline}</p>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

function StatCard({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-2xl bg-card p-6 shadow-card">
      <Icon className="h-6 w-6 text-primary" />
      <div className="mt-3 text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}