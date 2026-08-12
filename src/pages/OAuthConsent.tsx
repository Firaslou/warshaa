import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { BrandLogo } from "@/components/BrandLogo";

type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) { setError("Lien d'autorisation invalide"); return; }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) { setError(error.message); return; }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) { window.location.href = immediate; return; }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Erreur inconnue");
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth().approveAuthorization(authorizationId)
        : await oauth().denyAuthorization(authorizationId);
      if (error) { setBusy(false); setError(error.message); return; }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) { setBusy(false); setError("Aucune redirection retournée par le serveur d'autorisation."); return; }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Erreur inconnue");
    }
  }

  return (
    <PageLayout>
      <div className="container flex min-h-[70vh] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-elegant">
          <div className="mb-6 text-center">
            <BrandLogo showName={false} className="justify-center" markClassName="h-20" />
            <h1 className="mt-3 font-serif text-2xl font-bold">Autoriser l'accès</h1>
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
          {!error && !details && (
            <p className="text-center text-sm text-muted-foreground">Chargement…</p>
          )}
          {details && (
            <div className="space-y-4">
              <p className="text-sm">
                <span className="font-medium">{details.client?.name ?? "Une application"}</span>{" "}
                souhaite se connecter à ton compte Warsha et utiliser les outils Warsha en ton nom.
              </p>
              <p className="text-xs text-muted-foreground">
                Cette autorisation ne contourne pas les règles d'accès de Warsha. Tu peux la retirer à tout moment.
              </p>
              <div className="flex gap-2 pt-2">
                <Button disabled={busy} onClick={() => decide(true)} className="flex-1 gradient-warm text-primary-foreground">
                  Autoriser
                </Button>
                <Button disabled={busy} onClick={() => decide(false)} variant="outline" className="flex-1">
                  Refuser
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
