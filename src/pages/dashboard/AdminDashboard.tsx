import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, X, Flag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user, loading, isAdmin } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const fetchApps = async () => {
    const { data } = await supabase.from("startup_applications").select("*").eq("status", "pending").order("created_at", { ascending: false });
    setApps(data ?? []);
  };

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from("complaints")
      .select("*, startups:startup_id(name, slug), profiles:reporter_id(full_name)")
      .order("created_at", { ascending: false });
    setComplaints(data ?? []);
  };

  useEffect(() => { if (isAdmin) { fetchApps(); fetchComplaints(); } }, [isAdmin]);

  const updateComplaint = async (id: string, status: string) => {
    const { error } = await supabase
      .from("complaints")
      .update({ status: status as any, admin_response: responses[id] ?? null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Réclamation mise à jour");
    fetchComplaints();
  };

  const deleteComplaint = async (id: string) => {
    const { error } = await supabase.from("complaints").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Réclamation supprimée");
    fetchComplaints();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
      reviewing: "bg-blue-500/10 text-blue-700 border-blue-500/30",
      resolved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
      rejected: "bg-muted text-muted-foreground",
    };
    return map[s] ?? "";
  };

  const decide = async (app: any, status: "approved" | "rejected") => {
    if (status === "approved") {
      const { data, error } = await supabase.functions.invoke("approve-creator-application", {
        body: { application_id: app.id },
      });
      if (error) { toast.error(error.message); return; }
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      toast.success("Créateur approuvé · email envoyé");
      fetchApps();
      return;
    }
    await supabase.from("startup_applications").update({ status, reviewed_at: new Date().toISOString() }).eq("id", app.id);
    toast.success("Candidature rejetée");
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

        {/* COMPLAINTS */}
        <h2 className="mt-12 flex items-center gap-2 font-serif text-2xl font-semibold">
          <Flag className="h-6 w-6 text-destructive" />
          Réclamations ({complaints.filter((c) => c.status === "pending").length} en attente)
        </h2>
        {complaints.length === 0 ? (
          <p className="mt-6 text-muted-foreground">Aucune réclamation pour le moment.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {complaints.map((c) => (
              <div key={c.id} className="rounded-2xl bg-card p-6 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-lg font-bold">{c.subject}</h3>
                      <Badge variant="outline" className={statusBadge(c.status)}>{c.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Contre <strong>{c.startups?.name ?? c.startup_id}</strong> ·
                      Par {c.profiles?.full_name ?? "Utilisateur"} ·
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{c.message}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteComplaint(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-[1fr_200px_auto]">
                  <Textarea
                    rows={2}
                    placeholder="Réponse interne (optionnel)…"
                    defaultValue={c.admin_response ?? ""}
                    onChange={(e) => setResponses((r) => ({ ...r, [c.id]: e.target.value }))}
                  />
                  <Select defaultValue={c.status} onValueChange={(v) => updateComplaint(c.id, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="reviewing">En cours d'étude</SelectItem>
                      <SelectItem value="resolved">Résolu</SelectItem>
                      <SelectItem value="rejected">Rejeté</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => updateComplaint(c.id, c.status)} className="gradient-warm text-primary-foreground">
                    Enregistrer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}