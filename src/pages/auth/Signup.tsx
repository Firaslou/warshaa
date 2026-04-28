import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
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
        emailRedirectTo: window.location.origin,
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

      if (accountType === "startup") {
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: "startup" });
      }
    }

    setLoading(false);
    toast.success(t("auth.signupSuccess"));
    navigate(accountType === "startup" ? "/apply" : "/");
  };

  return (
    <PageLayout>
      <div className="container flex min-h-[70vh] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-elegant">
          <div className="mb-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-3 font-serif text-3xl font-bold">{t("auth.signupTitle")}</h1>
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
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.haveAccount")} <Link to="/login" className="font-medium text-primary hover:underline">{t("nav.login")}</Link>
          </p>
        </div>
      </div>
    </PageLayout>
  );
}