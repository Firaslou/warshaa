import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, BadgeCheck, BadgePlus, Award, Heart, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StartupCardData {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  city?: string | null;
  category?: string | null;
  cover_url?: string | null;
  badge: "new" | "verified" | "certified";
  likes_count?: number;
  supporters_count?: number;
}

export function StartupCard({ startup, index = 0 }: { startup: StartupCardData; index?: number }) {
  const { t } = useTranslation();

  const badgeMeta = {
    new: { label: t("startup.new"), icon: BadgePlus, className: "bg-warning/15 text-warning-foreground border-warning/30" },
    verified: { label: t("startup.verified"), icon: BadgeCheck, className: "bg-success/15 text-success border-success/30" },
    certified: { label: t("startup.certified"), icon: Award, className: "bg-primary/15 text-primary border-primary/30" },
  }[startup.badge];
  const Icon = badgeMeta.icon;

  return (
    <Link
      to={`/startup/${startup.slug}`}
      className="group block animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="overflow-hidden rounded-[32px] border border-clay-mist bg-card shadow-card md:rounded-xl md:border-transparent transition-smooth hover-lift">
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          {startup.cover_url ? (
            <img
              src={startup.cover_url}
              alt={startup.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
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
          {(startup.likes_count ?? 0) > 0 && (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs backdrop-blur">
              <Heart className="h-3 w-3 text-primary" />
              {startup.likes_count}
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="font-serif text-lg font-semibold leading-tight">{startup.name}</h3>
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
        </div>
      </div>
    </Link>
  );
}
