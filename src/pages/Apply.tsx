import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Video, Smartphone, Hand, BookOpen, ChevronRight, ChevronLeft, CheckCircle2, Clock } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TUNISIA_GOVERNORATES, TUNISIA_DELEGATIONS, CATEGORIES_KEYS } from "@/lib/tunisia";
import { cn } from "@/lib/utils";

const STEPS = ["step1", "step2", "step3", "step4"] as const;

export default function Apply() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    brand_name: "",
    description: "",
    city: "",
    delegation: "",
    category: "",
    whatsapp_number: "",
    instagram_url: "",
    facebook_url: "",
    proof_video_url: "",
  });

  const docs = [
    { icon: Camera, title: t("applyWizard.doc1Title"), desc: t("applyWizard.doc1Desc"), required: true },
    { icon: Video, title: t("applyWizard.doc2Title"), desc: t("applyWizard.doc2Desc"), required: true },
    { icon: Smartphone, title: t("applyWizard.doc3Title"), desc: t("applyWizard.doc3Desc"), required: true },
    { icon: Hand, title: t("applyWizard.doc4Title"), desc: t("applyWizard.doc4Desc"), required: true },
    { icon: BookOpen, title: t("applyWizard.doc5Title"), desc: t("applyWizard.doc5Desc"), required: false },
  ];

  const submit = async () => {
    if (!user) {
      toast({ title: t("apply.needAccount"), variant: "destructive" });
      navigate("/login");
      return;
    }
    if (!form.brand_name || !form.description || !form.city || !form.category || !form.whatsapp_number) {
      toast({ title: t("common.required"), variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("startup_applications").insert({
      applicant_id: user.id,
      brand_name: form.brand_name,
      description: form.description,
      city: form.city,
      category: form.category,
      whatsapp_number: form.whatsapp_number,
      instagram_url: form.instagram_url || null,
      facebook_url: form.facebook_url || null,
      proof_video_url: form.proof_video_url || null,
      proof_photos: [],
    });
    if (error) {
      toast({ title: error.message, variant: "destructive" });
      return;
    }
    setSubmitted(true);
    setStepIdx(3);
  };

  const delegations = form.city ? TUNISIA_DELEGATIONS[form.city as keyof typeof TUNISIA_DELEGATIONS] ?? [] : [];

  return (
    <PageLayout>
      <section className="container max-w-4xl py-12">
        {/* Stepper */}
        <div className="mb-10 flex items-center justify-between gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                i === stepIdx ? "border-primary bg-primary text-primary-foreground"
                : i < stepIdx ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                {i + 1}
              </div>
              <span className={cn("hidden text-sm font-medium md:inline", i === stepIdx ? "text-foreground" : "text-muted-foreground")}>
                {t(`applyWizard.${s}`)}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1 — Documents */}
        {stepIdx === 0 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-3xl font-bold">{t("applyWizard.prepareTitle")}</h1>
            <p className="mt-2 text-muted-foreground">
              {t("applyWizard.prepareIntro")}
            </p>
            <div className="mt-6 space-y-3">
              {docs.map((d, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <d.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{d.title}</p>
                        <p className="text-sm text-muted-foreground">{d.desc}</p>
                      </div>
                    </div>
                    <Badge variant={d.required ? "destructive" : "secondary"}>
                      {d.required ? t("applyWizard.obligatory") : t("applyWizard.recommended")}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <Button onClick={() => setStepIdx(1)} className="gradient-warm text-primary-foreground">
                {t("applyWizard.ready")} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Rules */}
        {stepIdx === 1 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-3xl font-bold">{t("applyWizard.rulesTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t("applyWizard.rulesIntro")}</p>
            <ul className="mt-6 space-y-3">
              {[1,2,3,4,5].map((n) => (
                <li key={n} className="flex items-start gap-3 rounded-lg border bg-card p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{t(`applyWizard.rule${n}`)}</span>
                </li>
              ))}
            </ul>
            <label className="mt-6 flex cursor-pointer items-center gap-3">
              <Checkbox checked={acceptedRules} onCheckedChange={(v) => setAcceptedRules(!!v)} />
              <span className="text-sm">{t("applyWizard.iAccept")}</span>
            </label>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStepIdx(0)}><ChevronLeft className="mr-1 h-4 w-4"/>{t("applyWizard.back")}</Button>
              <Button disabled={!acceptedRules} onClick={() => setStepIdx(2)} className="gradient-warm text-primary-foreground">
                {t("applyWizard.next")} <ChevronRight className="ml-1 h-4 w-4"/>
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Form */}
        {stepIdx === 2 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-3xl font-bold">{t("apply.title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("applyWizard.validatedIn48h")}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>{t("apply.brandName")} *</Label>
                <Input value={form.brand_name} onChange={(e)=>setForm({...form, brand_name:e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <Label>{t("apply.description")} *</Label>
                <Textarea rows={4} value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} />
              </div>
              <div>
                <Label>{t("apply.city")} *</Label>
                <Select value={form.city} onValueChange={(v)=>setForm({...form, city:v, delegation:""})}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {TUNISIA_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Délégation</Label>
                <Select value={form.delegation} onValueChange={(v)=>setForm({...form, delegation:v})} disabled={!form.city}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {delegations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("apply.category")} *</Label>
                <Select value={form.category} onValueChange={(v)=>setForm({...form, category:v})}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {CATEGORIES_KEYS.map((c) => <SelectItem key={c} value={c}>{t(`categoriesExt.${c}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("apply.whatsapp")} *</Label>
                <Input placeholder="+216..." value={form.whatsapp_number} onChange={(e)=>setForm({...form, whatsapp_number:e.target.value})} />
              </div>
              <div>
                <Label>{t("apply.instagram")}</Label>
                <Input value={form.instagram_url} onChange={(e)=>setForm({...form, instagram_url:e.target.value})} />
              </div>
              <div>
                <Label>{t("apply.facebook")}</Label>
                <Input value={form.facebook_url} onChange={(e)=>setForm({...form, facebook_url:e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <Label>{t("apply.proofVideo")} *</Label>
                <Input value={form.proof_video_url} onChange={(e)=>setForm({...form, proof_video_url:e.target.value})} />
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStepIdx(1)}><ChevronLeft className="mr-1 h-4 w-4"/>{t("applyWizard.back")}</Button>
              <Button onClick={submit} className="gradient-warm text-primary-foreground">
                {t("applyWizard.submitApplication")} <ChevronRight className="ml-1 h-4 w-4"/>
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Confirmation */}
        {stepIdx === 3 && (
          <div className="animate-fade-in py-10 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-bold">{t("applyWizard.pendingTitle")}</h1>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">{t("applyWizard.pendingDesc")}</p>
            <Button className="mt-8 gradient-warm text-primary-foreground" onClick={() => navigate("/")}>
              {t("applyWizard.backHome")}
            </Button>
          </div>
        )}
      </section>
    </PageLayout>
  );
}
