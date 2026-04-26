import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageLayout } from "@/components/layout/PageLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Signup() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"client" | "startup">("client");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error(t("auth.errors.weakPassword")); return; }
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
    // If user wants creator role, also insert it
    if (accountType === "startup" && data.user) {
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: "startup" });
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
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
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
            <Button type="submit" disabled={loading} className="w-full gradient-warm text-primary-foreground">
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