import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@/components/layout/PageLayout";
import { BrandLogo } from "@/components/BrandLogo";
import { MathCaptcha } from "@/components/MathCaptcha";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [captchaValid, setCaptchaValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaValid) { toast.error("Résolvez le captcha"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("Email envoyé — vérifiez votre boîte de réception.");
  };

  return (
    <PageLayout>
      <div className="container flex min-h-[70vh] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-elegant">
          <div className="mb-6 text-center">
            <BrandLogo showName={false} className="justify-center" markClassName="h-20" />
            <h1 className="mt-3 font-serif text-3xl font-bold">Mot de passe oublié</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Entrez votre email — nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
          </div>
          {sent ? (
            <div className="rounded-xl border border-success/30 bg-success/10 p-5 text-center">
              <Mail className="mx-auto h-8 w-8 text-success" />
              <p className="mt-3 font-medium">Email envoyé !</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cliquez sur le lien reçu à <strong>{email}</strong> pour définir un nouveau mot de passe.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <MathCaptcha onValidChange={setCaptchaValid} />
              <Button type="submit" disabled={loading || !captchaValid} className="w-full gradient-warm text-primary-foreground">
                {loading ? "Envoi…" : "Envoyer le lien"}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">Retour à la connexion</Link>
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
