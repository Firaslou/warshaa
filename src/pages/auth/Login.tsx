import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@/components/layout/PageLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("Invalid") ? t("auth.errors.invalidCredentials") : error.message);
      return;
    }
    toast.success(t("auth.loginSuccess"));
    navigate("/");
  };

  return (
    <PageLayout>
      <div className="container flex min-h-[70vh] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-elegant">
          <div className="mb-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-3 font-serif text-3xl font-bold">{t("auth.loginTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-warm text-primary-foreground">
              {loading ? t("common.loading") : t("auth.loginBtn")}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")} <Link to="/signup" className="font-medium text-primary hover:underline">{t("nav.signup")}</Link>
          </p>
        </div>
      </div>
    </PageLayout>
  );
}