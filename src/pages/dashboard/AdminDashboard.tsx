import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user, loading, isAdmin } = useAuth();
  const [apps, setApps] = useState<any[]>([]);

  const fetchApps = async () => {
    const { data } = await supabase.from("startup_applications").select("*").eq("status", "pending").order("created_at", { ascending: false });
    setApps(data ?? []);
  };

  useEffect(() => { if (isAdmin) fetchApps(); }, [isAdmin]);

  const decide = async (app: any, status: "approved" | "rejected") => {
    if (status === "approved") {
      const slug = app.brand_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + app.id.slice(0, 6);
      const { error: sErr } = await supabase.from("startups").insert({
        owner_id: app.applicant_id,
        name: app.brand_name, slug, description: app.description, city: app.city, category: app.category,
        whatsapp_number: app.whatsapp_number, instagram_url: app.instagram_url, facebook_url: app.facebook_url,
        status: "approved", badge: "new",
      });
      if (sErr) { toast.error(sErr.message); return; }
      await supabase.from("user_roles").insert({ user_id: app.applicant_id, role: "startup" }).then(() => {});
    }
    await supabase.from("startup_applications").update({ status, reviewed_at: new Date().toISOString() }).eq("id", app.id);
    toast.success("OK");
    fetchApps();
  };

  if (loading) return <PageLayout><div className="container py-20 text-center">{t("common.loading")}</div></PageLayout>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <PageLayout><div className="container py-20 text-center text-muted-foreground">403 — Admins only</div></PageLayout>;

  return (
    <PageLayout>
      <div className="container py-12">
        <h1 className="font-serif text-4xl font-bold">{t("dashboard.admin.title")}</h1>
        <h2 className="mt-8 font-serif text-2xl font-semibold">{t("dashboard.admin.applications")}</h2>
        {apps.length === 0 ? (
          <p className="mt-6 text-muted-foreground">{t("dashboard.admin.noApplications")}</p>
        ) : (
          <div className="mt-6 space-y-4">
            {apps.map((a) => (
              <div key={a.id} className="rounded-2xl bg-card p-6 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-xl font-bold">{a.brand_name}</h3>
                    <div className="mt-1 flex gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">{a.city}</Badge>
                      <Badge variant="outline">{a.category}</Badge>
                    </div>
                    <p className="mt-3 text-sm">{a.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">📱 {a.whatsapp_number} {a.instagram_url && `· IG: ${a.instagram_url}`} {a.facebook_url && `· FB: ${a.facebook_url}`}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(a, "approved")} className="gradient-warm text-primary-foreground"><Check className="mr-1 h-3 w-3" /> {t("dashboard.admin.approve")}</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(a, "rejected")}><X className="mr-1 h-3 w-3" /> {t("dashboard.admin.reject")}</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}