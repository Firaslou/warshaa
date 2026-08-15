import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLayout } from "@/components/layout/PageLayout";
import { BrandLogo } from "@/components/BrandLogo";
import { MathCaptcha } from "@/components/MathCaptcha";
import { supabase } from "@/integrations/supabase/client";
import { TUNISIA_GOVERNORATES, TUNISIA_DELEGATIONS, CATEGORIES_KEYS, type Governorate } from "@/lib/tunisia";
import { toast } from "sonner";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(100),
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "Min 6 caractères").max(72),
  gender: z.enum(["female", "male", "other", "unspecified"]),
  governorate: z.string().min(1, "Sélectionnez un gouvernorat"),
  city: z.string().optional(),
});

export default function Signup() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"client" | "startup">("client");
  const [gender, setGender] = useState<"female" | "male" | "other" | "unspecified">("unspecified");
  const [governorate, setGovernorate] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [captchaValid, setCaptchaValid] = useState(false);
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: next ? window.location.origin + next : window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message ?? "Erreur Google");
    }
  };

  const delegations = useMemo(
    () => (governorate ? TUNISIA_DELEGATIONS[governorate as Governorate] ?? [] : []),
    [governorate],
  );

  const toggleCategory = (key: string) => {
    setPreferredCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaValid) { toast.error("Veuillez résoudre le captcha"); return; }

    const parsed = signupSchema.safeParse({ fullName, email, password, gender, governorate, city });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: next ? window.location.origin + next : window.location.origin,
        data: { full_name: fullName, preferred_language: i18n.language },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message.includes("already") ? t("auth.errors.emailExists") : error.message);
      return;
    }

    // Update profile with extra fields
    if (data.user) {
      await supabase.from("profiles").update({
        full_name: fullName,
        gender,
        city: city || governorate,
        preferred_categories: preferredCategories,
        preferred_language: i18n.language,
      }).eq("id", data.user.id);

      // NOTE: The "startup" role is NEVER self-assigned. It is granted only by an admin
      // after the creator submits an application via /apply and gets approved.
    }

    setLoading(false);
    toast.success(t("auth.signupSuccess"));
    navigate(next ?? (accountType === "startup" ? "/apply" : "/"));
  };

  return (
    <PageLayout>
      <div className="container flex min-h-[70vh] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-elegant">
          <div className="mb-6 text-center">
            <BrandLogo showName={false} className="justify-center" markClassName="h-20" />
            <h1 className="mt-2 font-serif text-3xl font-bold">{t("auth.signupTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("auth.signupSubtitle")}</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">{t("auth.fullName")}</Label>
              <Input id="name" required maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" required minLength={6} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div>
              <Label className="mb-2 block">Genre</Label>
              <RadioGroup value={gender} onValueChange={(v) => setGender(v as any)} className="grid grid-cols-2 gap-2">
                {[
                  { v: "female", label: "Femme" },
                  { v: "male", label: "Homme" },
                  { v: "other", label: "Autre" },
                  { v: "unspecified", label: "Non précisé" },
                ].map((g) => (
                  <label key={g.v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2 text-sm hover:bg-accent">
                    <RadioGroupItem value={g.v} /> {g.label}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gouvernorat</Label>
                <Select value={governorate} onValueChange={(v) => { setGovernorate(v); setCity(""); }}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-64">
                    {TUNISIA_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ville / Délégation</Label>
                <Select value={city} onValueChange={setCity} disabled={!governorate}>
                  <SelectTrigger><SelectValue placeholder={governorate ? "Choisir" : "Gouvernorat d'abord"} /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-64">
                    {delegations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Univers préférés (facultatif)</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES_KEYS.map((key) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-xs hover:bg-accent">
                    <Checkbox
                      checked={preferredCategories.includes(key)}
                      onCheckedChange={() => toggleCategory(key)}
                    />
                    {t(`categoriesExt.${key}`)}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">{t("auth.accountType")}</Label>
              <RadioGroup value={accountType} onValueChange={(v) => setAccountType(v as "client" | "startup")} className="gap-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent">
                  <RadioGroupItem value="client" />
                  <span className="text-sm">{t("auth.client")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent">
                  <RadioGroupItem value="startup" />
                  <span className="text-sm">{t("auth.creator")}</span>
                </label>
              </RadioGroup>
            </div>

            <MathCaptcha onValidChange={setCaptchaValid} />

            <Button type="submit" disabled={loading || !captchaValid} className="w-full gradient-warm text-primary-foreground">
              {loading ? t("common.loading") : t("auth.signupBtn")}
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuer avec Google
          </Button>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.haveAccount")} <Link to="/login" className="font-medium text-primary hover:underline">{t("nav.login")}</Link>
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
