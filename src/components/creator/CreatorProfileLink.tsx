import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function CreatorProfileLink() {
  const { user } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      setSlug(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("startups")
        .select("slug")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!cancelled) setSlug(data?.slug ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!slug) return null;

  const profileUrl = `${window.location.origin}/startup/${encodeURIComponent(slug)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("Lien de votre profil Warsha copié !");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  return (
    <div className="container pb-0 pt-4 sm:pt-6">
      <Card className="overflow-hidden border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" />
            Votre profil Warsha
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Partagez ce lien dans votre bio Instagram, Facebook, TikTok ou WhatsApp pour envoyer directement votre audience vers votre profil Warsha.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm">
            <span className="block truncate">{profileUrl}</span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={copyLink}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copié" : "Copier le lien"}
            </Button>
            <Button type="button" variant="default" asChild>
              <a href={profileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Voir mon profil
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
