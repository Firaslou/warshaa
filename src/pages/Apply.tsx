import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Video, Smartphone, Hand, BookOpen, ChevronRight, ChevronLeft, CheckCircle2, Clock, ShieldAlert, Heart, Upload, X } from "lucide-react";
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
import { blobToFile, compressImage } from "@/lib/image-utils";
import { LocationPicker } from "@/components/LocationPicker";

const STEPS = ["step1", "step2", "step3", "step4"] as const;

export default function Apply() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [form, setForm] = useState({
    brand_name: "",
    description: "",
    city: "",
    delegation: "",
    latitude: null as number | null,
    longitude: null as number | null,
    categories: [] as string[],
    whatsapp_number: "",
    instagram_url: "",
    facebook_url: "",
    tiktok_url: "",
    proof_video_url: "",
    creator_story: "",
    proof_photos: [] as string[],
    verification_photo_url: "",
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
    if (!form.brand_name || !form.description || !form.city || form.categories.length === 0 || !form.whatsapp_number) {
      toast({ title: t("common.required"), variant: "destructive" });
      return;
    }
    if (!form.proof_video_url || form.proof_photos.length < 3 || !form.verification_photo_url) {
      toast({
        title: "Section Sécurité incomplète",
        description: "La vidéo (10s), 3 photos réelles et la photo de vérification sont obligatoires. Sans elles, la demande sera annulée.",
        variant: "destructive",
      });
      return;
    }
    const applicationData = {
      applicant_id: user.id,
      brand_name: form.brand_name,
      description: form.description,
      city: form.city,
      delegation: form.delegation || null,
      latitude: form.latitude,
      longitude: form.longitude,
      category: form.categories[0],
      categories: form.categories,
      whatsapp_number: form.whatsapp_number,
      instagram_url: form.instagram_url || null,
      facebook_url: form.facebook_url || null,
      tiktok_url: form.tiktok_url || null,
      proof_video_url: form.proof_video_url || null,
      proof_photos: [...form.proof_photos, form.verification_photo_url].filter(Boolean),
      creator_story: form.creator_story || null,
    };
    const { data: application, error } = await supabase.from("startup_applications").insert(applicationData as any).select("id").single();
    if (error) {
      toast({ title: error.message, variant: "destructive" });
      return;
    }

    try {
      const { error: emailError } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "creator-application",
          recipientEmail: "warsha.startups@gmail.com",
          idempotencyKey: `creator-application-${application.id}`,
          templateData: {
            "Nom de la marque": form.brand_name,
            "Email du demandeur": user.email ?? "Non disponible",
            "Ville": form.city,
            "Délégation": form.delegation || "Non renseignée",
            "Catégories": form.categories.join(", "),
            "WhatsApp": form.whatsapp_number,
            "Description": form.description,
            "Instagram": form.instagram_url || "Non renseigné",
            "Facebook": form.facebook_url || "Non renseigné",
            "TikTok": form.tiktok_url || "Non renseigné",
          },
        },
      });
      if (emailError) console.warn("Creator application notification email failed:", emailError);
    } catch (emailError) {
      console.warn("Creator application notification email failed:", emailError);
    }

    setSubmitted(true);
    setStepIdx(3);
  };

  const uploadFile = async (
    file: File,
    field: "proof_video_url" | "verification_photo_url" | "proof_photos",
  ) => {
    if (!user) {
      toast({ title: t("apply.needAccount"), variant: "destructive" });
      return;
    }
    if (field === "proof_video_url") {
      if (!file.type.startsWith("video/")) {
        toast({ title: "Fichier vidéo requis", variant: "destructive" });
        return;
      }
      const duration = await new Promise<number>((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve(v.duration);
        v.onerror = () => resolve(0);
        v.src = URL.createObjectURL(file);
      });
      if (duration > 10.5) {
        toast({
          title: "Vidéo trop longue",
          description: `Maximum 10 secondes (la tienne fait ${Math.round(duration)}s).`,
          variant: "destructive",
        });
        return;
      }
    } else if (!file.type.startsWith("image/")) {
      toast({ title: "Image requise", variant: "destructive" });
      return;
    }

    setUploadingField(field + (field === "proof_photos" ? `-${form.proof_photos.length}` : ""));
    try {
      let uploadFile = file;
      if (!file.type.startsWith("video/")) {
        const compressedBlob = await compressImage(file, { maxWidth: 1600, quality: 0.82 });
        if (compressedBlob.size < file.size) uploadFile = blobToFile(compressedBlob, file.name);
      }
      const ext = uploadFile.name.split(".").pop() || (uploadFile.type === "image/webp" ? "webp" : "jpg");
      const path = `${user.id}/${field}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("applications").upload(path, uploadFile, {
        upsert: false,
        contentType: uploadFile.type,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("applications").getPublicUrl(path);
      if (field === "proof_photos") {
        setForm((f) => ({ ...f, proof_photos: [...f.proof_photos, data.publicUrl] }));
      } else {
        setForm((f) => ({ ...f, [field]: data.publicUrl }));
      }
    } catch (error: any) {
      toast({ title: error.message ?? "Échec de l’envoi du fichier", variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  };

  const delegations = form.city ? TUNISIA_DELEGATIONS[form.city as keyof typeof TUNISIA_DELEGATIONS] ?? [] : [];

  return (
    <PageLayout>
      <section className="container max-w-4xl py-12">
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

        {stepIdx === 0 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-3xl font-bold">{t("applyWizard.prepareTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t("applyWizard.prepareIntro")}</p>
            <div className="mt-6 space-y-3">
              {docs.map((d, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><d.icon className="h-5 w-5 text-primary" /></div>
                      <div><p className="font-semibold">{d.title}</p><p className="text-sm text-muted-foreground">{d.desc}</p></div>
                    </div>
                    <Badge variant={d.required ? "destructive" : "secondary"}>{d.required ? t("applyWizard.obligatory") : t("applyWizard.recommended")}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-8 flex justify-end"><Button onClick={() => setStepIdx(1)} className="gradient-warm text-primary-foreground">{t("applyWizard.ready")} <ChevronRight className="ml-1 h-4 w-4" /></Button></div>
          </div>
        )}

        {stepIdx === 1 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-3xl font-bold">{t("applyWizard.rulesTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t("applyWizard.rulesIntro")}</p>
            <ul className="mt-6 space-y-3">{[1,2,3,4,5].map((n) => <li key={n} className="flex items-start gap-3 rounded-lg border bg-card p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{t(`applyWizard.rule${n}`)}</span></li>)}</ul>
            <label className="mt-6 flex cursor-pointer items-center gap-3"><Checkbox checked={acceptedRules} onCheckedChange={(v) => setAcceptedRules(!!v)} /><span className="text-sm">{t("applyWizard.iAccept")}</span></label>
            <div className="mt-8 flex justify-between"><Button variant="ghost" onClick={() => setStepIdx(0)}><ChevronLeft className="mr-1 h-4 w-4"/>{t("applyWizard.back")}</Button><Button disabled={!acceptedRules} onClick={() => setStepIdx(2)} className="gradient-warm text-primary-foreground">{t("applyWizard.next")} <ChevronRight className="ml-1 h-4 w-4"/></Button></div>
          </div>
        )}

        {stepIdx === 2 && (
          <div className="animate-fade-in">
            <h1 className="font-serif text-3xl font-bold">{t("apply.title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("applyWizard.validatedIn48h")}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><Label>{t("apply.brandName")} *</Label><Input value={form.brand_name} onChange={(e)=>setForm({...form, brand_name:e.target.value})} /></div>
              <div className="md:col-span-2"><Label>{t("apply.description")} *</Label><Textarea rows={4} value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} /></div>
              <div><Label>{t("apply.city")} *</Label><Select value={form.city} onValueChange={(v)=>setForm({...form, city:v, delegation:""})}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent className="bg-popover">{TUNISIA_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{t("applyExtra.delegation")}</Label><Select value={form.delegation} onValueChange={(v)=>setForm({...form, delegation:v})} disabled={!form.city}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent className="bg-popover">{delegations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>

              <LocationPicker latitude={form.latitude} longitude={form.longitude} onChange={(latitude, longitude) => setForm((f) => ({ ...f, latitude, longitude }))} />

              <div className="md:col-span-2"><Label>{t("apply.category")} * <span className="text-xs text-muted-foreground">{t("applyExtra.multipleAllowed")}</span></Label><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{CATEGORIES_KEYS.map((c) => { const checked = form.categories.includes(c); return <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-xs hover:bg-accent"><Checkbox checked={checked} onCheckedChange={() => setForm((f) => ({ ...f, categories: checked ? f.categories.filter((k) => k !== c) : [...f.categories, c] }))} />{t(`categoriesExt.${c}`)}</label>; })}</div></div>
              <div><Label>{t("apply.whatsapp")} *</Label><Input placeholder="+216..." value={form.whatsapp_number} onChange={(e)=>setForm({...form, whatsapp_number:e.target.value})} /></div>
              <div><Label>{t("apply.instagram")}</Label><Input value={form.instagram_url} onChange={(e)=>setForm({...form, instagram_url:e.target.value})} /></div>
              <div><Label>{t("apply.facebook")}</Label><Input value={form.facebook_url} onChange={(e)=>setForm({...form, facebook_url:e.target.value})} /></div>
              <div className="md:col-span-2"><Label>TikTok <span className="text-xs text-muted-foreground">{t("applyExtra.optional")}</span></Label><Input placeholder="https://tiktok.com/@..." value={form.tiktok_url} onChange={(e)=>setForm({...form, tiktok_url:e.target.value})} /></div>

              <div className="md:col-span-2 mt-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5"><div className="mb-3 flex items-center gap-2"><Heart className="h-5 w-5 text-primary" /><h3 className="font-serif text-lg font-bold">{t("applyExtra.storyTitle")}</h3><Badge variant="secondary">{t("applyExtra.storyOptional")}</Badge></div><p className="mb-3 text-sm text-muted-foreground">{t("applyExtra.storyDesc")}</p><Textarea rows={5} placeholder={t("applyExtra.storyPlaceholder")} value={form.creator_story} onChange={(e)=>setForm({...form, creator_story:e.target.value})} /></div>

              <div className="md:col-span-2 mt-4 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-5">
                <div className="mb-3 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" /><h3 className="font-serif text-lg font-bold">{t("applyExtra.securityTitle")}</h3><Badge variant="destructive">{t("applyExtra.obligatory")}</Badge></div>
                <div className="mb-4 rounded-lg border border-destructive/30 bg-background p-3 text-sm">⚠️ <strong>{t("applyExtra.warning")}</strong> {t("applyExtra.warningDesc")}</div>
                <div className="mb-5"><Label className="flex items-center gap-2"><Video className="h-4 w-4" /> {t("applyExtra.videoLabel")} *</Label><p className="mt-1 text-xs text-muted-foreground">{t("applyExtra.videoHint")}</p><div className="mt-2 flex items-center gap-3"><Input type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "proof_video_url")} disabled={uploadingField === "proof_video_url"} />{form.proof_video_url && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}</div>{form.proof_video_url && <video src={form.proof_video_url} controls className="mt-2 h-32 rounded-md border" />}</div>
                <div className="mb-5"><Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> {t("applyExtra.photosLabel")} * ({form.proof_photos.length}/3)</Label><p className="mt-1 text-xs text-muted-foreground">{t("applyExtra.photosHint")}</p><div className="mt-2 grid grid-cols-3 gap-2">{form.proof_photos.map((url, i) => <div key={i} className="relative"><img src={url} alt={`Preuve ${i+1}`} className="h-24 w-full rounded-md border object-cover" /><button type="button" onClick={() => setForm((f) => ({ ...f, proof_photos: f.proof_photos.filter((_, idx) => idx !== i) }))} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"><X className="h-3 w-3" /></button></div>)}{form.proof_photos.length < 3 && <label className="flex h-24 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border hover:border-primary"><Upload className="h-5 w-5 text-muted-foreground" /><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "proof_photos")} /></label>}</div></div>
                <div><Label className="flex items-center gap-2"><Hand className="h-4 w-4" /> {t("applyExtra.verifLabel")} *</Label><p className="mt-1 text-xs text-muted-foreground">{t("applyExtra.verifHint")}</p><div className="mt-2 flex items-center gap-3"><Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "verification_photo_url")} disabled={uploadingField === "verification_photo_url"} />{form.verification_photo_url && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}</div>{form.verification_photo_url && <img src={form.verification_photo_url} alt="Vérification" className="mt-2 h-32 rounded-md border object-cover" />}</div>
              </div>
            </div>
            <div className="mt-8 flex justify-between"><Button variant="ghost" onClick={() => setStepIdx(1)}><ChevronLeft className="mr-1 h-4 w-4"/>{t("applyWizard.back")}</Button><Button onClick={submit} className="gradient-warm text-primary-foreground">{t("applyWizard.submitApplication")} <ChevronRight className="ml-1 h-4 w-4"/></Button></div>
          </div>
        )}

        {stepIdx === 3 && (
          <div className="animate-fade-in py-10 text-center"><div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"><Clock className="h-10 w-10 text-primary" /></div><h1 className="font-serif text-3xl font-bold">{t("applyWizard.pendingTitle")}</h1><p className="mx-auto mt-3 max-w-md text-muted-foreground">{t("applyWizard.pendingDesc")}</p><Button className="mt-8 gradient-warm text-primary-foreground" onClick={() => navigate("/")}>{t("applyWizard.backHome")}</Button></div>
        )}
      </section>
    </PageLayout>
  );
}
