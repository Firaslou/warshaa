import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TUNISIAN_CITIES, CATEGORIES } from "@/lib/demo";
import { toast } from "sonner";

export default function Apply() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    brand_name: "", description: "", city: "", category: "",
    whatsapp_number: "", instagram_url: "", facebook_url: "", proof_video_url: "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error(t("apply.needAccount")); navigate("/login"); return; }
    setLoading(true);
    const { error } = await supabase.from("startup_applications").insert({
      applicant_id: user.id, ...form,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("apply.success"));
    navigate("/dashboard");
  };

  return (
    <PageLayout>
      <div className="container max-w-2xl py-12">
        <h1 className="font-serif text-4xl font-bold">{t("apply.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("apply.subtitle")}</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl bg-card p-6 shadow-card">
          <div><Label>{t("apply.brandName")}</Label><Input required value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} /></div>
          <div><Label>{t("apply.description")}</Label><Textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>{t("apply.city")}</Label>
              <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">{TUNISIAN_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("apply.category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>{t("apply.whatsapp")}</Label><Input required placeholder="+216..." value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>{t("apply.instagram")}</Label><Input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} /></div>
            <div><Label>{t("apply.facebook")}</Label><Input value={form.facebook_url} onChange={(e) => setForm({ ...form, facebook_url: e.target.value })} /></div>
          </div>
          <div><Label>{t("apply.proofVideo")}</Label><Input value={form.proof_video_url} onChange={(e) => setForm({ ...form, proof_video_url: e.target.value })} /></div>
          <Button type="submit" disabled={loading} className="w-full gradient-warm text-primary-foreground">
            {loading ? t("common.loading") : t("apply.submit")}
          </Button>
        </form>
      </div>
    </PageLayout>
  );
}