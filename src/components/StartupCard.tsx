import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, BadgeCheck, BadgePlus, Award, Heart, Store, Share2, Check } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/contexts/FavoritesContext";
import { toast } from "sonner";

export interface StartupCardData {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  city?: string | null;
  category?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  badge: "new" | "verified" | "certified";
  likes_count?: number;
  supporters_count?: number;
  delegation?: string | null;
}

export function StartupCard({ startup, index = 0 }: { startup: StartupCardData; index?: number }) {
  const { t } = useTranslation();
  const { isStartupFavorite, toggleStartupFavorite } = useFavorites();
  const [copied, setCopied] = useState(false);

  const isFav = isStartupFavorite(startup.id);

  const badgeMeta = {
    new: { label: t("startup.new"), icon: BadgePlus, className: "bg-warning/15 text-warning-foreground border-warning/30" },
    verified: { label: t("startup.verified"), icon: BadgeCheck, className: "bg-success/15 text-success border-success/30" },
    certified: { label: t("startup.certified"), icon: Award, className: "bg-primary/15 text-primary border-primary/30" },
  }[startup.badge || "new"];
  const Icon = badgeMeta.icon;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleStartupFavorite(startup.id);
  };

  const handleShareClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}/startup/${startup.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${startup.name} sur Warsha`, text: startup.tagline ?? `Découvre ${startup.name} sur Warsha.`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien du profil copié");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        setCopied(true);
        toast.success("Lien du profil copié");
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Impossible de copier le lien.");
      }
    }
  };

  return (
    <Link
      to={`/startup/${startup.slug}`}
      className="group block animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="overflow-hidden rounded-[32px] border border-clay-mist bg-card shadow-card md:rounded-2xl md:border-transparent transition-smooth hover-lift">
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          {startup.logo_url ? (
            <img
              src={startup.logo_url}
              alt={startup.name}
              loading="lazy"
              className="h-full w-full object-contain p-8 transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center gradient-soft">
              <Store className="h-12 w-12 text-primary/40" />
            </div>
          )}
          <div className="absolute left-3 top-3">
            <Badge variant="outline" className={cn("border bg-background/90 backdrop-blur", badgeMeta.className)}>
              <Icon className="mr-1 h-3 w-3" /> {badgeMeta.label}
            </Badge>
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleFavoriteClick}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur transition hover:scale-110 active:scale-95",
                isFav ? "text-rose-500" : "text-muted-foreground hover:text-foreground"
              )}
              title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-label="Favori"
            >
              <Heart className={cn("h-4 w-4 transition-transform", isFav && "fill-rose-500 text-rose-500 scale-110")} />
            </button>
            {(startup.likes_count ?? 0) > 0 && !isFav && (
              <span className="rounded-full bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur">
                {startup.likes_count}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2 p-4">
          <h3 className="font-serif text-lg font-semibold leading-tight group-hover:text-primary transition-colors">
            {startup.name}
          </h3>
          {startup.tagline && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{startup.tagline}</p>
          )}
          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            {startup.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {startup.city}
              </span>
            )}
            {startup.category && <span>· {startup.category}</span>}
          </div>
          <button
            type="button"
            onClick={handleShareClick}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            aria-label={`Partager le profil de ${startup.name}`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? "Lien copié" : "Partager le profil"}
          </button>
        </div>
      </div>
    </Link>
  );
}
